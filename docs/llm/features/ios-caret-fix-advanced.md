# iOS Caret Fix -- Hit-Region & DOM Layers

> Companion to `ios-caret-fix.md` | Layers 9, 10 | **Last Updated**: 2026-03-04

### Layer 9 -- DOM Order: Expanded Content Above Anchor Row

**File**: `src/widgets/terminal-view/ui/KeyboardToolbar.tsx`

WKWebView caches touch hit-regions for `position:fixed` subtrees. When a flex column
grows upward (bottom anchor + rows added below), existing elements move visually but
their touch targets stay at old Y positions.

**Rule**: In a bottom-anchored toolbar, render expanded rows **above** the anchor row.
Anchor row Y never changes -- touch targets always correct.

```tsx
// CORRECT: expanded rows above main row
<div className="shrink-0 border-t ...">
  {panel === "tmux" && <TmuxRows />}
  {panel === "vi"   && <ViRow />}
  {panel !== "none" && <SelectorTabs />}
  {/* Main row -- ALWAYS LAST, Y never changes */}
  <div className="flex items-center ...">...</div>
</div>

// WRONG: expanded below main (pushes main up -> stale hit regions)
<div className="shrink-0 border-t ...">
  <div className="flex items-center ...">main row</div>
  {panel !== "none" && <SelectorTabs />}
  {panel === "tmux" && <TmuxRows />}
</div>
```

### Layer 10 -- JS: Hit-region refresh after --vvh change

**Files**: `src/shared/lib/useVisualViewport.ts`, `src/widgets/terminal-view/ui/KeyboardToolbar.tsx`

When `--vvh` changes (safe-area settle: 840->778px), WKWebView does NOT auto-update
hit-regions for `position:fixed` children. Touch targets remain at old Y positions.

**Fix**: `triggerHitRegionRefresh()` -- briefly decreases `--vvh` by 1px then restores
in next rAF, forcing `viewDidLayoutSubviews` to recalculate hit-regions.

```typescript
let _currentVvh = 0;
export function triggerHitRegionRefresh(): void {
  if (_currentVvh <= 1) return;
  const el = document.documentElement;
  el.style.setProperty("--vvh", (_currentVvh - 1) + "px");
  requestAnimationFrame(() => el.style.setProperty("--vvh", _currentVvh + "px"));
}

// After --vvh changes: double rAF then nudge
} else if (vvhChanged) {
  requestAnimationFrame(() => requestAnimationFrame(triggerHitRegionRefresh));
}

// KeyboardToolbar.tsx -- after panel toggle
const togglePanel = (target: ExpandedPanel) => {
  setPanel((p) => (p === target ? "none" : target));
  requestAnimationFrame(() => requestAnimationFrame(triggerHitRegionRefresh));
};
```

`naturalHeightRef` allows small downward corrections (< 15%) for safe-area settle
(840->778 = 7.4%). Without this, `kbGone=false` permanently after settle.

## Extended What NOT to Do

| Avoid | Reason |
|-------|--------|
| `scrollTo(0,1)` alone for hit-region refresh | iOS batches 0->1->0 as no-op; no `viewDidLayoutSubviews` |
| `will-change:transform` on toolbar | Extra compositing layer; worsens stale-region bugs |
| Skipping `triggerHitRegionRefresh()` after --vvh/panel change | Hit-regions stay at old Y coords |
| Reading `vv.height` in `useRef` init as canonical | Pre-safe-area-inset value (WebKit #191872) |
| `-webkit-overflow-scrolling: touch` on form containers | Caret freezes at focus (WebKit #138201) |
| `setTimeout(0)` for iOS IME pair coalescing | Fires between delete+insert events |
| Rendering expandable content BELOW anchor in fixed flex column | Pushes anchor up; stale hit regions |

## Tauri iOS API Reference

```rust
window.with_webview(|wv| {
    let wk = wv.inner() as *mut objc2::runtime::AnyObject; // WKWebView*
    let sv = msg_send![wk, scrollView];                    // UIScrollView*
    // UIScrollViewContentInsetAdjustmentBehaviorNever = 3
    // UIScrollViewContentInsetAdjustmentBehaviorAutomatic = 0
})
```

`wv.inner()` -> `*mut c_void` (WKWebView) via `tauri::PlatformWebview` (iOS only).
