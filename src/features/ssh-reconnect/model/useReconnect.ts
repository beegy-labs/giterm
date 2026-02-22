import { useSessionStore } from "@/entities/session";
import { useConnectionStore } from "@/entities/connection";
import {
  connectFromConfig,
  classifySshError,
} from "@/features/ssh-connect/adapters/api/sshApi";

/** Maps sessionId → cancel function for active reconnection attempts */
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
 */
export async function reconnectSession(sessionId: string) {
  const state = useSessionStore.getState();
  const session = state.sessions.find((s) => s.sessionId === sessionId);
  if (!session) return;

  const connection = useConnectionStore
    .getState()
    .getConnection(session.connectionId);
  if (!connection) return;

  let cancelled = false;
  const cancel = () => {
    cancelled = true;
    useSessionStore.getState().updateSession(sessionId, {
      status: "disconnected",
      reconnectAttempt: 0,
    });
  };
  activeReconnects.set(sessionId, cancel);

  useSessionStore.getState().updateSession(sessionId, {
    status: "reconnecting",
    reconnectAttempt: 1,
  });

  try {
    const newSessionId = await connectFromConfig(connection);
    if (cancelled) return;

    useSessionStore.getState().updateSession(sessionId, {
      sessionId: newSessionId,
      status: "connected",
      reconnectAttempt: 0,
      error: undefined,
    });
  } catch (err) {
    if (cancelled) return;
    useSessionStore.getState().updateSession(sessionId, {
      status: "error",
      error: classifySshError(err),
      reconnectAttempt: 0,
    });
  } finally {
    activeReconnects.delete(sessionId);
  }
}
