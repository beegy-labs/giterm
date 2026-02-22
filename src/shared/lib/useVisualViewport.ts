import { useEffect, useState } from "react";

/**
 * Tracks the visual viewport height on iOS.
 * When the software keyboard appears, the visual viewport shrinks.
 * Returns the current viewport height in pixels.
 */
export function useVisualViewport() {
  const [height, setHeight] = useState(() =>
    typeof window !== "undefined"
      ? window.visualViewport?.height ?? window.innerHeight
      : 0,
  );

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => setHeight(vv.height);
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return height;
}
