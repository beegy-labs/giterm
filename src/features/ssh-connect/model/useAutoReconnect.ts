import { useEffect, useRef } from "react";
import { useSessionStore } from "@/entities/session";
import { reconnectSession } from "./useReconnect";

/**
 * Auto-reconnect sessions that were connected before the app was backgrounded.
 *
 * iOS background model:
 * - WKWebView and the Rust process are suspended ~30s after backgrounding
 * - SSH keepalives (Rust, 15s interval) keep the connection alive briefly,
 *   but the OS typically terminates TCP sockets during extended suspension
 * - On foreground resume, sessions that received a disconnect event while
 *   the Rust process was still running will have status "disconnected"
 *
 * Strategy: snapshot "connected" session IDs on hide, then auto-reconnect
 * any that transitioned to "disconnected" while the app was backgrounded.
 * Intentional disconnects by the user are NOT auto-reconnected (the snapshot
 * is cleared on each hide/show cycle).
 */
export function useAutoReconnect() {
  const sessionIdsOnHideRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        // Snapshot currently connected sessions
        const sessions = useSessionStore.getState().sessions;
        sessionIdsOnHideRef.current = new Set(
          sessions
            .filter((s) => s.status === "connected")
            .map((s) => s.sessionId),
        );
      } else if (document.visibilityState === "visible") {
        const snapshot = sessionIdsOnHideRef.current;
        if (snapshot.size === 0) return;

        // Reconnect sessions that dropped while backgrounded
        const sessions = useSessionStore.getState().sessions;
        for (const session of sessions) {
          if (
            snapshot.has(session.sessionId) &&
            session.status === "disconnected"
          ) {
            reconnectSession(session.sessionId);
          }
        }

        sessionIdsOnHideRef.current = new Set();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);
}
