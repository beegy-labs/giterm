# iOS Caret Fix -- Viewport & Keyboard Layers

> Companion to `ios-caret-fix.md` | Layers 5, 6, 7, 8 | **Last Updated**: 2026-03-12

### Layer 5 -- CSS: Mobile Safe Area Architecture

**Files**: `src/index.css`, `src/widgets/mobile-layout/ui/MobileLayout.tsx`, `src/shared/ui/mobile-screen.tsx`

```css
.pt-safe-bar    { padding-top: env(safe-area-inset-top); }
.pt-safe-header { padding-top: calc(env(safe-area-inset-top) + 0.25rem); }
```

**Rule**: `pt-safe-bar` on `MobileLayout` root **only**. Children must NOT duplicate safe area padding.

```tsx
// CORRECT -- MobileLayout is the single safe area SSOT
<DevFrame className="... pt-safe-bar ...">       {/* MobileLayout -- has safe area */}
  <AdBanner />                                    {/* no safe area */}
  <MobileSessionTabBar />                         {/* no safe area */}
  {terminalView}
</DevFrame>

// CORRECT -- MobileScreen children use plain padding
<MobileScreen>
  <MobileScreen.Header className="...">           {/* pt-1, NOT pt-safe-header */}
  <MobileScreen.Bar className="...">              {/* no pt-safe-bar */}
</MobileScreen>

// WRONG -- double safe area padding
<DevFrame className="pt-safe-bar">
  <MobileSessionTabBar className="pt-safe-bar">   {/* DOUBLE padding */}
</DevFrame>
```

**DevFrame**: Labels on elements with `pt-safe` classes are offset below safe area via `env(safe-area-inset-top)`.
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
