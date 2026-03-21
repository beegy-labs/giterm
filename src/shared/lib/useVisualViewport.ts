import { useEffect, useLayoutEffect, useRef } from "react";
import { vpLogAppend } from "@/shared/adapters/viewportLogApi";

const IOS_SAFE_AREA_CACHE_KEY = "giterm:ios-safe-area:v1";

interface CachedSafeArea {
  top: number;
  bottom: number;
}

function isIosDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function getSafeAreaCacheSlot(): string {
  const shortEdge = Math.min(window.screen.width, window.screen.height);
  const longEdge = Math.max(window.screen.width, window.screen.height);
  const orientation =
    window.innerWidth > window.innerHeight ? "landscape" : "portrait";
  return `${shortEdge}x${longEdge}:${orientation}`;
}

function readCachedSafeArea(): CachedSafeArea | null {
  try {
    const raw = window.localStorage.getItem(IOS_SAFE_AREA_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, CachedSafeArea>;
    const cached = parsed[getSafeAreaCacheSlot()];
    if (!cached) return null;
    if (cached.top < 0 || cached.bottom < 0) return null;
    return cached;
  } catch {
    return null;
  }
}

function applySafeArea(top: number, bottom: number): void {
  const el = document.documentElement;
  el.style.setProperty("--sat", `${top}px`);
  el.style.setProperty("--sab", `${bottom}px`);
  el.style.setProperty("--vvh-safe-bottom", `${bottom}px`);
  el.dataset.iosSafeAreaReady = "true";
}

/**
 * Trigger iOS WKWebView to recalculate position:fixed touch hit-regions.
 *
 * Keyboard show/hide works because UIKit calls viewDidLayoutSubviews on the
 * WKWebView host, which forces a full compositing + hit-region recalculation.
 *
 * window.scrollTo() alone does NOT trigger this — iOS may batch 0→1→0 as a
 * no-op if both calls happen within the same rendering cycle.
 *
 * This function forces a REAL layout change by briefly decreasing --vvh by 1px
 * (same mechanism as keyboard shrink) and restoring in the next frame.
 * The 1px delta is imperceptible but forces iOS to perform a full layout pass.
 *
 * Call this after any DOM change inside a position:fixed container that would
 * cause elements to shift (e.g. panel expand/collapse in KeyboardToolbar).
 */
let _currentVvh = 0;

// Guards against scroll events fired by the scroll nudge inside triggerHitRegionRefresh.
// Without this flag, scrollTo(0,1) → vv.scroll → update("SCROLL") can briefly report
// a slightly different vv.height (e.g. 780 vs 778), setting --vvh to a wrong value and
// causing visible oscillation on iOS WKWebView.
let _scrollNudgeActive = false;

export function triggerHitRegionRefresh(): void {
  if (_currentVvh <= 1) return;
  const el = document.documentElement;
  // Step 1: CSS nudge — change outer fixed div height by 1px to invalidate
  // compositor layers and force a layout pass.
  el.style.setProperty("--vvh", (_currentVvh - 1) + "px");
  _scrollNudgeActive = true;
  requestAnimationFrame(() => {
    el.style.setProperty("--vvh", _currentVvh + "px");
    // Step 2: Scroll nudge — a real 1px document scroll forces WKWebView to call
    // viewDidLayoutSubviews, which recalculates position:fixed touch hit-regions.
    // The CSS nudge alone may not be sufficient.
    // NOTE: do NOT set body.style.minHeight here — it fights iOS's viewport
    // recalculation and causes vvh to oscillate (e.g. 778↔780) continuously.
    // scrollTo(0, 1) works without it on iOS WKWebView (confirmed via logs).
    window.scrollTo(0, 1);
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      // Clear flag after both scroll calls so any real scroll event after this
      // point (e.g. keyboard show/hide) is processed normally.
      requestAnimationFrame(() => {
        _scrollNudgeActive = false;
      });
    });
  });
}

/**
 * SSOT for visual viewport height on iOS.
 *
 * Sets --vvh CSS variable on <html>:
 *   --vvh — visual viewport height (shrinks when keyboard shows)
 *
 * No React state — CSS engine propagates to all consumers automatically.
 *
 * UIScrollView.contentOffset is handled by window.scrollTo(0,0) on scroll events.
 * MobileLayout uses position:fixed which anchors to the visual viewport regardless
 * of contentOffset — no transform compensation needed.
 *
 * iOS 26 regression: visualViewport.offsetTop sticks after keyboard dismiss.
 * Handled by useIosScrollReset in App.tsx (focusout + 150ms).
 *
 * WebKit Bug #191872: env(safe-area-inset-*) is NOT applied until after the first
 * render. WKWebView reports visualViewport.height = window.innerHeight initially
 * (e.g. 840px), then fires a RESIZE event once safe-area-insets are applied
 * (e.g. 778px). This delay is 163ms–37s depending on the device/session.
 *
 * Fix strategy (Capacitor/Cordova production pattern + hit-region fix):
 *   1. useLayoutEffect: set initial --vvh to current vv.height (best effort).
 *   2. update("MOUNT"): re-read immediately in useEffect (handles pre-settled case).
 *   3. Double rAF: re-read after 2 frames — WebKit applies insets by then (~32ms).
 *   4. Periodic polls at 100ms–10s: safety net for the React StrictMode double-mount
 *      window where a RESIZE event fired between cleanup and re-attach could be missed.
 *   5. RESIZE handler: fallback for late settling (up to 37s in extreme cases).
 *   6. Hit-region refresh: after --vvh changes, window.scrollTo(0,0) forces WKWebView
 *      to recalculate position:fixed touch hit-regions. Without this, touch targets
 *      remain at the old (pre-settle, --vvh=840) Y positions even after layout reflows.
 *
 * naturalH tracking: allows small downward corrections (< 15%) for safe-area settle
 * (e.g. 840→778, ~7%) while ignoring large drops (keyboard show, ~50%).
 *
 * NOTE: 100dvh = 100vh = window.innerHeight (840px) in Tauri WKWebView because
 * setMinimumViewportInset is not configured. Do NOT use dvh as a workaround.
 */
export function useVisualViewport() {
  const naturalHeightRef = useRef(
    typeof window !== "undefined"
      ? window.visualViewport?.height ?? window.innerHeight
      : 0,
  );

  // Track last --vvh to detect significant changes that require hit-region refresh.
  const lastVvhRef = useRef(0);

  // Set initial CSS variables before first paint.
  // --app-h: SSOT for full-screen height. NEVER shrinks when keyboard appears.
  //   Used by overlay-fullscreen utility (dialogs, overlays, MobileLayout).
  //   Updated only when keyboard is hidden (handles orientation changes).
  // --vvh: visual viewport height. Shrinks when keyboard shows.
  //   Used ONLY by the terminal section wrapper in MobileLayout.
  // --vvh-safe-bottom: exact bottom safe area from native CSS vars when the
  //   keyboard is hidden; 0 while the keyboard is visible.
  useLayoutEffect(() => {
    const el = document.documentElement;
    const h = window.innerHeight;
    el.style.setProperty("--app-h", h + "px");
    el.style.setProperty("--vvh", h + "px");

    // Safe area SSOT:
    //   1. Native UIKit injection (exact, may arrive before React boot)
    //   2. Cached exact value from the previous launch on this device/orientation
    //   3. Zero until native reports a real inset
    //
    // Never fall back to env(safe-area-inset-*): WebKit Bug #191872 applies it
    // asynchronously and causes a visible second layout pass.
    if (isIosDevice()) {
      const nativeTop = Number.parseFloat(el.style.getPropertyValue("--sat"));
      const nativeBottom = Number.parseFloat(el.style.getPropertyValue("--sab"));
      if (nativeTop > 0 || nativeBottom > 0) {
        applySafeArea(nativeTop, nativeBottom);
      } else {
        const cached = readCachedSafeArea();
        if (cached) {
          applySafeArea(cached.top, cached.bottom);
        } else {
          // No native injection yet and no cache — render with 0px safe area.
          // Native retry loop corrects this at 16–50ms via giterm:safe-area-ready event.
          applySafeArea(0, 0);
        }
      }
    } else {
      applySafeArea(0, 0);
    }

    _currentVvh = h;
    lastVvhRef.current = window.visualViewport?.height ?? h;
  }, []);

  useEffect(() => {
    const handleSafeAreaReady = (event: Event) => {
      const { detail } = event as CustomEvent<CachedSafeArea>;
      if (!detail) return;
      applySafeArea(detail.top, detail.bottom);
    };
    window.addEventListener("giterm:safe-area-ready", handleSafeAreaReady as EventListener);

    const vv = window.visualViewport;
    if (!vv) {
      return () => {
        window.removeEventListener(
          "giterm:safe-area-ready",
          handleSafeAreaReady as EventListener,
        );
      };
    }

    // Reset naturalH to the currently observed vv.height.
    // The useRef initializer runs at render time (pre-settle, may be 840px).
    // By useEffect time the viewport may already have settled to the correct
    // value (e.g. 778px), so we reset here for correct kbGone detection.
    naturalHeightRef.current = vv.height;

    vpLogAppend(
      `INIT: innerH=${window.innerHeight} vv.h=${vv.height.toFixed(0)} vv.off=${vv.offsetTop.toFixed(0)} scrollY=${window.scrollY}`,
    );

    const update = (source: string) => {
      const height = vv.height;
      const rawOffsetTop = vv.offsetTop;

      // Track natural (keyboard-hidden) height.
      // Allow small downward corrections (< 15%) for WebKit safe-area-inset settle
      // (e.g. 840→778 = 7.4%). Ignore large drops (keyboard show, ~50%) to
      // preserve naturalH so keyboard detection stays accurate.
      const drop = naturalHeightRef.current - height;
      if (height > naturalHeightRef.current) {
        naturalHeightRef.current = height;
      } else if (drop > 0 && drop < naturalHeightRef.current * 0.15) {
        naturalHeightRef.current = height;
      }

      // iOS 26 bug: offsetTop sticks non-zero after keyboard dismiss.
      // If height has fully restored (within 80px of natural), keyboard is gone.
      // 80px threshold covers iOS form assistant bar (▲▼✓, ~44px) without
      // triggering on the actual keyboard (250px+).
      // Force offsetTop to 0 so the layout stays anchored.
      const keyboardGone = naturalHeightRef.current - height < 80;
      const offsetTop = keyboardGone ? 0 : rawOffsetTop;

      vpLogAppend(
        `${source}: vv.h=${height.toFixed(0)} vv.off=${rawOffsetTop.toFixed(0)} naturalH=${naturalHeightRef.current.toFixed(0)} kbGone=${keyboardGone} offsetTop=${offsetTop.toFixed(0)} scrollY=${window.scrollY.toFixed(0)}`,
      );

      const delta = Math.abs(height - lastVvhRef.current);
      // Trigger hit-region refresh for significant vv.height changes (keyboard
      // show/hide, > 50px). Skip small changes (iOS form assistant bar = 34px).
      const vvhChangedSignificant = delta > 50;
      lastVvhRef.current = height;

      // --vvh-safe-bottom: exact bottom safe area from UIKit while the keyboard is
      // hidden. iOS hides the home indicator inset while the keyboard is visible.
      const bottomSafeArea =
        document.documentElement.style.getPropertyValue("--sab") || "0px";
      document.documentElement.style.setProperty(
        "--vvh-safe-bottom",
        keyboardGone ? bottomSafeArea : "0px",
      );

      // --app-h: set once in useLayoutEffect to window.innerHeight (full screen).
      // NEVER updated here — keeps the device's maximum screen height (e.g. 840px
      // on iPhone 17 Pro) so overlay-fullscreen elements always fill edge-to-edge.

      // --vvh: tracks visual viewport height (shrinks with keyboard).
      // When keyboard is hidden, use window.innerHeight (full screen) so the layout
      // fills edge-to-edge; --vvh-safe-bottom on KeyboardToolbar keeps content above the
      // home indicator. When keyboard is visible, use vv.height (shrunk by keyboard).
      const vvhValue = keyboardGone ? window.innerHeight : height;
      if (vvhValue !== _currentVvh) {
        document.documentElement.style.setProperty("--vvh", vvhValue + "px");
        _currentVvh = vvhValue;
      }

      if (rawOffsetTop !== 0) {
        // Reset UIScrollView.contentOffset via JS scroll API.
        // Works only when html/body do NOT have overflow:hidden.
        window.scrollTo(0, 0);
        vpLogAppend(
          `scrollTo(0,0): after scrollY=${window.scrollY} (should be 0 if overflow:hidden removed)`,
        );
      } else if (vvhChangedSignificant) {
        // Large vv.height change (> 50px): keyboard show/hide.
        // Force WKWebView to recalculate position:fixed touch hit-regions.
        requestAnimationFrame(() => requestAnimationFrame(triggerHitRegionRefresh));
      }
    };

    // Immediate update: handles the case where the viewport was already settled
    // before this effect ran (no RESIZE event fired because vp didn't change).
    update("MOUNT");

    // Double rAF: WebKit Bug #191872 — env(safe-area-inset-*) not applied until
    // after the first render. Re-reading after 2 frames (~32ms) catches the
    // safe-area-inset application that occurs within the first paint cycle.
    // This is the Capacitor/Cordova production pattern for this bug.
    let rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(() => update("RAF"));
    });

    // Periodic safety net: React StrictMode unmounts+remounts on dev. If a RESIZE
    // event fires in the narrow window between cleanup and re-attach, it is missed.
    // These polls re-read vv.height to catch any late safe-area settle.
    // In production, these are mostly no-ops (height already settled).
    const POLL_DELAYS = [100, 500, 1000, 5000, 10000];
    const timers = POLL_DELAYS.map((ms) =>
      setTimeout(() => update(`POLL_${ms}ms`), ms),
    );

    // Debounce resize/scroll handlers at 100ms.
    // iOS keyboard animation (~300ms) fires many scroll events with changing
    // vv.height values. Updating --vvh on each event causes layout thrashing
    // and WebGL artifacts. By debouncing, --vvh changes exactly ONCE after
    // the animation settles (300ms animation + 100ms wait = ~400ms total).
    // The 100ms window covers the gap between the last animation event and
    // the final stable viewport height.
    let updateTimer: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
      if (updateTimer) clearTimeout(updateTimer);
      updateTimer = setTimeout(() => {
        updateTimer = null;
        update("RESIZE");
      }, 100);
    };
    const handleScroll = () => {
      if (_scrollNudgeActive) return;
      if (updateTimer) clearTimeout(updateTimer);
      updateTimer = setTimeout(() => {
        updateTimer = null;
        update("SCROLL");
      }, 100);
    };

    vv.addEventListener("resize", handleResize);
    vv.addEventListener("scroll", handleScroll);

    return () => {
      if (updateTimer) clearTimeout(updateTimer);
      cancelAnimationFrame(rafId);
      timers.forEach(clearTimeout);
      vv.removeEventListener("resize", handleResize);
      vv.removeEventListener("scroll", handleScroll);
      window.removeEventListener(
        "giterm:safe-area-ready",
        handleSafeAreaReady as EventListener,
      );
    };
  }, []);
}
