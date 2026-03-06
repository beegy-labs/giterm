# iOS Caret Fix -- Viewport & Keyboard Layers

> Companion to `ios-caret-fix.md` | Layers 5, 6, 7, 8 | **Last Updated**: 2026-03-04

### Layer 5 -- CSS: Mobile Screen Header Pattern

**File**: `src/index.css` + all mobile screen components

```css
.pt-safe-bar    { padding-top: env(safe-area-inset-top); }
.pt-safe-header { padding-top: calc(env(safe-area-inset-top) + 0.75rem); }
```

**Rule**: Never put `pt-safe` on the outer screen container.
Put it on the first visible element (header/bar) instead.

```tsx
// CORRECT -- header absorbs safe area; background fills under Dynamic Island
<div className="flex h-full flex-col bg-background">
  <div className="pt-safe-header flex items-center border-b ...">
    <h1>Screen Title</h1>
  </div>
</div>

// WRONG -- outer container pt-safe creates visible empty gap
<div className="flex h-full flex-col bg-background pt-safe">
```

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
useLayoutEffect(() => {
  const h = (window.visualViewport?.height ?? window.innerHeight);
  document.documentElement.style.setProperty("--vvh", h + "px");
}, []);

// WebKit Bug #191872: safe-area-insets not applied until after first render.
// 3-stage fix: 1. update("MOUNT")  2. double rAF  3. RESIZE handler
```

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
