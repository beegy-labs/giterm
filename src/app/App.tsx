import { useEffect } from "react";
import { QueryProvider } from "@/app/providers/QueryProvider";
import { ErrorBoundary } from "@/shared/ui/error-boundary";
import { TerminalPage } from "@/pages/terminal";

/**
 * iOS 26 regression: after keyboard dismissal, visualViewport.offsetTop stays non-zero,
 * keeping the layout viewport scrolled down permanently.
 *
 * A 150ms delay is required (per WebKit bug research) — window.scrollTo(0,0) called
 * before iOS finishes its keyboard-dismiss animation is ignored.
 * Requires html/body to NOT have overflow:hidden (see index.css).
 */
function useIosScrollReset() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handleFocusOut = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => window.scrollTo(0, 0), 150);
    };
    document.addEventListener("focusout", handleFocusOut);
    return () => {
      document.removeEventListener("focusout", handleFocusOut);
      if (timer) clearTimeout(timer);
    };
  }, []);
}

export default function App() {
  useIosScrollReset();
  return (
    <ErrorBoundary>
      <QueryProvider>
        <TerminalPage />
      </QueryProvider>
    </ErrorBoundary>
  );
}
