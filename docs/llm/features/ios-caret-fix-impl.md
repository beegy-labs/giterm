# iOS Caret Fix -- Viewport & Keyboard Layers

> Companion to `ios-caret-fix.md` | Layers 5, 6, 7, 8 | **Last Updated**: 2026-03-23

### Layer 5 -- CSS: Mobile Safe Area Architecture

> Full SSOT → `docs/llm/features/ios-viewport.md`

**Rule**: Safe area padding on **headers/bars only**, NEVER on `MobileLayout` container.

```css
/* src/index.css — uses CSS vars, never env() */
.pt-safe-bar    { padding-top: calc(var(--sat, 0px) + var(--ad-banner-h, 0px)); }
.pt-safe-header { padding-top: calc(var(--sat, 0px) + var(--ad-banner-h, 0px) + 0.25rem); }
```

```
MobileLayout (NO pt-safe — container never shrinks)
├── MobileSessionTabBar  ← pt-safe-bar   (absorbs --sat)
└── MobileScreen.Header  ← pt-safe-header (absorbs --sat + 4px)
```

`--sat` / `--sab` injected natively via ObjC retry loop in `src-tauri/src/lib.rs`.
`env(safe-area-inset-top)` is NEVER used (WebKit Bug #191872 — value is 0 at first render).

**DevFrame**: Labels on elements with `pt-safe` classes are offset below safe area.
See `src/shared/ui/dev-frame.tsx`.

### Layer 6 -- JS: visualViewport scroll reset + focusout fix

**Files**: `src/shared/lib/useVisualViewport.ts`, `src/app/App.tsx`

```typescript
// useVisualViewport.ts -- scroll reset on iOS contentOffset change
const handleScroll = () => update("SCROLL");
vv.addEventListener("scroll", handleScroll);

// App.tsx -- iOS 26: offsetTop sticks after keyboard dismiss
function useIosScrollReset() {
  useEffect(() => {
    const handleFocusOut = () => {
      setTimeout(() => window.scrollTo(0, 0), 150);
    };
    document.addEventListener("focusout", handleFocusOut);
    return () => document.removeEventListener("focusout", handleFocusOut);
  }, []);
}
```

`visualViewport.scroll` fires on any `contentOffset` change (even programmatic).
150ms focusout delay required -- immediate `scrollTo(0,0)` is ignored during
keyboard-dismiss animation (WebKit behavior).

### Layer 7 -- HTML: `inputMode="none"` on HiddenImeInput

**File**: `src/widgets/terminal-view/ui/HiddenImeInput.tsx`

```tsx
<input inputMode={inputMode} ... />
// inputMode="none"  -> no virtual keyboard (default, viewport stable)
// inputMode="text"  -> virtual keyboard (required for Korean IME)
```

Keyboard shrinks `visualViewport.height` by ~96px. `KeyboardToolbar` toggle (leftmost
button) switches between `inputMode="none"` and `inputMode="text"` for Korean IME.

### Layer 8 -- CSS vars as SSOT for viewport geometry

**Files**: `src/shared/lib/useVisualViewport.ts`, `src/shared/ui/dialog.tsx`, `src/pages/terminal/ui/TerminalPage.tsx`

`useVisualViewport` is the **single source of truth** -- sets `--vvh` CSS var on `<html>`.
All layout consumers read from CSS, not React state.

```typescript
// useVisualViewport.ts -- sets --vvh, returns void (no React state)
// Resize/scroll handlers debounced 100ms to prevent layout thrashing during keyboard animation
let updateTimer: ReturnType<typeof setTimeout> | null = null;
const handleResize = () => {
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(() => { updateTimer = null; update("RESIZE"); }, 100);
};

// WebKit Bug #191872: safe-area-insets not applied until after first render.
// 3-stage fix: 1. update("MOUNT")  2. double rAF  3. RESIZE handler
```

**Keyboard resize pipeline** (3-layer debounce):
1. `useVisualViewport`: `--vvh` CSS update debounced 100ms
2. `useTerminalInstances`: ResizeObserver → `fitAddon.fit()` debounced 100ms
3. `useTerminalInstances`: `sshResize()` IPC debounced 150ms after fit

| CSS Variable | Consumer | Purpose |
|---|---|---|
| `--vvh` | `dialog.tsx`, MobileLayout | Viewport height (shrinks on keyboard) |

```tsx
// MobileLayout -- position:fixed + CSS var height, NO transform
<div className="fixed left-0 top-0 w-screen overflow-hidden bg-background"
     style={{ height: "var(--vvh, 100vh)" }}>

// dialog.tsx -- keyboard-safe centering
<div style={{ height: "var(--vvh, 100vh)" }} className="fixed inset-x-0 top-0 ...">
```

**NOTE**: `100dvh` != `visualViewport.height` in Tauri WKWebView.
`100dvh = 100svh = 100lvh = window.innerHeight` (no `setMinimumViewportInset`).
Do NOT use `dvh` units as `--vvh` fallback.
