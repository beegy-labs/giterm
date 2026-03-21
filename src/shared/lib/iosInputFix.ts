/**
 * iOS WKWebView Input Focus-Zoom Prevention — SSOT
 *
 * The PRIMARY fix is CSS-based: all form controls are forced to 16px via
 * @supports (-webkit-touch-callout: none) in index.css.
 *
 * This module provides a JS-side utility for any additional focus handling
 * needed by components (e.g. scrolling a focused input into view within
 * a scrollable dialog body).
 */

const IS_IOS =
  typeof navigator !== "undefined" &&
  /iPad|iPhone|iPod/.test(navigator.userAgent);

function findScrollParent(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    if (
      (style.overflowY === "auto" || style.overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * On iOS, scroll the focused input into view within its nearest scrollable
 * ancestor (e.g. dialog body). This prevents WKWebView from performing its
 * own native viewport scroll adjustment.
 *
 * IMPORTANT: Do NOT call window.scrollTo() — it triggers useVisualViewport
 * handlers and causes layout oscillation.
 */
export function iosInputFocusFix(target: HTMLElement): void {
  if (!IS_IOS) return;

  requestAnimationFrame(() => {
    const scrollParent = findScrollParent(target);
    if (!scrollParent) return;

    const inputRect = target.getBoundingClientRect();
    const parentRect = scrollParent.getBoundingClientRect();

    if (inputRect.bottom > parentRect.bottom) {
      scrollParent.scrollTop += inputRect.bottom - parentRect.bottom + 12;
    } else if (inputRect.top < parentRect.top) {
      scrollParent.scrollTop -= parentRect.top - inputRect.top + 12;
    }
  });
}
