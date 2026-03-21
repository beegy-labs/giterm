import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;

const mql =
  typeof window !== "undefined"
    ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    : null;

function subscribe(onStoreChange: () => void): () => void {
  mql?.addEventListener("change", onStoreChange);
  return () => mql?.removeEventListener("change", onStoreChange);
}

function getSnapshot(): boolean {
  return mql?.matches ?? false;
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
