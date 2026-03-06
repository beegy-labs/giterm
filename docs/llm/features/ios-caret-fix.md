# iOS WKWebView Layout & Caret Fix Policy

> WKWebView scroll/layout bugs on iOS | **Last Updated**: 2026-03-04

## Symptoms

- Caret/selection handles shift below input on 2nd tap or text selection
- Content shifts down on any tap; both caused by `UIScrollView` auto-scrolling

## Root Cause

WKWebView embeds content in `UIScrollView` which auto-scrolls on:

1. **Keyboard appearance**: adjusts `contentInset` to bring focused input into view
2. **Element focus/tap**: scrolls `contentOffset` to bring element into view

Both shift native layout viewport while WebKit computes caret in pre-scroll coords.
Related WebKit bugs: #176896 (transform caret), #138201 (overflow-scrolling caret).

## Applied Fixes (10 layers)

### Layer 1 — Native: Disable UIScrollView Auto-Adjustment + Bounce

**File**: `src-tauri/src/lib.rs`

```rust
#[cfg(target_os = "ios")]
{
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        window.with_webview(|wv| {
            use objc2::msg_send;
            use objc2::runtime::AnyObject;
            let wk = wv.inner() as *mut AnyObject;
            unsafe {
                let sv: *mut AnyObject = msg_send![wk, scrollView];
                let _: () = msg_send![sv, setContentInsetAdjustmentBehavior: 3i64];
                let _: () = msg_send![sv, setScrollEnabled: false];
                let _: () = msg_send![sv, setBounces: false];
            }
        }).ok();
    }
}
```

**Cargo.toml**: `[target.'cfg(target_os = "ios")'.dependencies] objc2 = "0.6"`

`setScrollEnabled: false` prevents user gestures but NOT programmatic `setContentOffset:`. Root fix: `position: fixed` (Layer 4).

### Layer 2 — CSS: No Transform on Dialog Container

**File**: `src/shared/ui/dialog.tsx`

```diff
- fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%]
+ (centering wrapper: fixed inset-0 flex items-center justify-center)
+ (content: relative, no transform)
```

CSS `transform` on ancestor causes caret coords in pre-transform system (WebKit #176896).

### Layer 3 — CSS: Opacity Animation on Focus

**File**: `src/index.css`

```css
@keyframes ios-caret-fix { from { opacity: 0.9999; } to { opacity: 1; } }
input:focus, textarea:focus { animation: ios-caret-fix 0.01s; }
```

Suppresses WKWebView's scroll-to-focus trigger on input focus (10ms, invisible).

### Layer 4 — CSS: `position: fixed` on Mobile Root Container

**File**: `src/pages/terminal/ui/TerminalPage.tsx` -- `MobileLayout`

```tsx
<div className="fixed left-0 top-0 w-screen overflow-hidden bg-background"
     style={{ height: viewportHeight }}>
```

`position: fixed` anchors to VISUAL VIEWPORT regardless of `UIScrollView.contentOffset`.
`viewportHeight = visualViewport.height` tracks keyboard appearance.

## What NOT to Do

| Avoid | Reason |
|-------|--------|
| `pt-safe` on outer screen container | Creates visible empty gap above header |
| `transform: translate(-50%, -50%)` on modal | Caret rendered pre-transform (WebKit #176896) |
| `transform` on `position:fixed` MobileLayout | Breaks touch coordinate system |
| `100dvh` as `--vvh` fallback | In Tauri WKWebView, `dvh = vh = innerHeight` |
| `overflow:hidden` on `html/body` | Blocks `window.scrollTo` -- scroll reset is no-op |

## References

| Companion | Content |
|-----------|---------|
| `ios-caret-fix-impl.md` | Layers 5-8: Viewport, keyboard, CSS vars |
| `ios-caret-fix-advanced.md` | Layers 9-10: Hit-region, DOM order, Tauri API |
