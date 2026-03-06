import { useSessionStore } from "@/entities/session";
import { useConnectionStore, selectConnectionById } from "@/entities/connection";
import { connectFromConfig, classifySshError } from "../adapters/api/sshApi";

/** Maps sessionId -> cancel function for active reconnection attempts */
const activeReconnects = new Map<string, () => void>();

export function cancelReconnect(sessionId: string) {
  const cancel = activeReconnects.get(sessionId);
  if (cancel) {
    cancel();
    activeReconnects.delete(sessionId);
  }
}

/**
 * Manually triggered reconnect for a disconnected session.
 * Sets status to "reconnecting" while connecting, then "connected" or "error".
 *
 * On success the session's `sessionId` is updated to the new backend ID so that
 * `sshWrite` / `sshResize` target the correct Rust session. The xterm instance
 * migration from old key -> new key is handled by `useTerminalInstances`.
 */
export async function reconnectSession(sessionId: string) {
  const state = useSessionStore.getState();
  const session = state.sessions.find((s) => s.sessionId === sessionId);
  if (!session) return;

  const connection = selectConnectionById(session.connectionId)(
    useConnectionStore.getState(),
  );
  if (!connection) return;

  let cancelled = false;
  const cancel = () => {
    cancelled = true;
    useSessionStore.getState().updateSession(sessionId, {
      status: "disconnected",

    });
  };
  activeReconnects.set(sessionId, cancel);

  useSessionStore.getState().updateSession(sessionId, {
    status: "reconnecting",
  });

  try {
    const newSessionId = await connectFromConfig(connection);
    if (cancelled) return;

    useSessionStore.getState().updateSession(sessionId, {
      sessionId: newSessionId,
      status: "connected",

      error: undefined,
    });
  } catch (err) {
    if (cancelled) return;
    useSessionStore.getState().updateSession(sessionId, {
      status: "error",
      error: classifySshError(err),

    });
  } finally {
    activeReconnects.delete(sessionId);
  }
}
