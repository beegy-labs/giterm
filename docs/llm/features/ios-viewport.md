# iOS Viewport Safe Area Fix

> SSOT | **Last Updated**: 2026-03-22

## Root Cause (Two-Layer Problem)

```
Layer 1: WebKit Bug #191872
  env(safe-area-inset-top) = 0 at first render
  settles to real value (e.g. 59px) after 163ms–7s
  → CSS padding-based layout shifts after initial render

Layer 2: iOS host safe area reapplication
  UIViewController + WKWebView re-apply safe area insets after launch
  physically resizes WKWebView layout viewport (840px → 778px)
  → JS/CSS cannot prevent this — requires native ObjC fix
```

Confirmed via diagnostic: disabling ALL JS updates still caused the shrink.
`window.innerHeight` changed from 840→778 without any JS intervention.

## Fix Architecture

### Native (src-tauri/src/lib.rs)

```
inject_ios_safe_area(window) called at setup
  └─ retry loop: [0, 16, 50, 100, 250, 500, 1000]ms
      └─ per attempt (main thread):
          ├─ read_safe_area_insets(wk)        → try wk.safeAreaInsets, window.safeAreaInsets
          ├─ neutralize_controller_safe_area() → additionalSafeAreaInsets = negative compensation
          │                                      edgesForExtendedLayout = .all
          ├─ apply_viewport_insets()           → setMinimumViewportInset = setMaximumViewportInset
          ├─ pin_webview_to_window_bounds()    → WKWebView + superview + scrollView frame = window.bounds
          └─ apply_safe_area_to_dom()          → inject --sat, --sab, --vvh-safe-bottom
                                                 cache in localStorage (key: giterm:ios-safe-area:v1)
                                                 dispatch giterm:safe-area-ready event
```

### Frontend (src/shared/lib/useVisualViewport.ts)

```
useLayoutEffect (sync, before first paint):
  1. --app-h  = window.innerHeight  (device max, NEVER updated again)
  2. --vvh    = window.innerHeight  (initial)
  3. --sat    = native injected value → localStorage cache → 0
  4. --sab    = native injected value → localStorage cache → 0
  5. --vvh-safe-bottom = --sab value

env() path completely removed. All safe area via --sat/--sab only.
```

### CSS (src/index.css)

```css
/* Safe area via --sat only (no env()) */
.pt-safe-bar    { padding-top: var(--sat); }
.pt-safe-header { padding-top: calc(var(--sat) + 0.25rem); }

/* Hide #root until native safe area ready (prevents layout flash) */
#root:not([data-ios-safe-area-ready]) { opacity: 0; }
#root[data-ios-safe-area-ready]       { opacity: 1; transition: opacity 0.1s; }
```

## Safe Area Component Architecture

```
MobileLayout (overlay-fullscreen, NO pt-safe-bar)  ← container never shrinks
├── MobileConnectionList
│   └── MobileScreen.Header (pt-safe-header)       ← absorbs --sat + 4px
├── Terminal section (flex-1)
│   ├── MobileSessionTabBar (pt-safe-bar)           ← absorbs --sat
│   └── TerminalView
```

**Rule**: Safe area padding on **headers only**, never on containers.
Adding pt-safe-bar to a flex container reduces its children's available space.

## CSS Variables

| Variable | Set by | Value when | Purpose |
|----------|--------|-----------|---------|
| `--app-h` | useLayoutEffect | window.innerHeight (e.g. 840px) | Full screen height, NEVER changes |
| `--vvh` | update() | visualViewport.height | Shrinks with keyboard |
| `--sat` | native inject → cache → 0 | e.g. 59px | Safe area top |
| `--sab` | native inject → cache → 0 | e.g. 34px | Safe area bottom |
| `--vvh-safe-bottom` | useLayoutEffect | --sab value | KeyboardToolbar bottom padding |

## Flutter vs Tauri Comparison

Flutter does not have this issue because Flutter renders via Metal/Skia, bypassing
WKWebView entirely. WKWebView inherits UIKit's safe area system which late-applies
insets. Tauri (WKWebView-based) requires explicit native suppression.

## Key Files

| File | Role |
|------|------|
| `src-tauri/src/lib.rs` | Native fix: retry loop, ObjC API calls |
| `src/shared/lib/useVisualViewport.ts` | --app-h, --vvh, --sat, --sab init |
| `src/index.css` | .pt-safe-bar, .pt-safe-header, #root opacity |
| `src/shared/ui/mobile-screen.tsx` | MobileScreen.Header/Bar with pt-safe-* |
| `src/widgets/mobile-layout/ui/MobileSessionTabBar.tsx` | pt-safe-bar on tab bar |
