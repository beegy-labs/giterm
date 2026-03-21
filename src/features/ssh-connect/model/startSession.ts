import { useSessionStore } from "@/entities/session";
import { type ConnectionConfig } from "@/entities/connection";
import { connectFromConfig, classifySshError } from "../adapters/api/sshApi";

/**
 * Creates a placeholder session, connects via SSH, and promotes the
 * placeholder to a real session on success (or marks it as errored).
 *
 * Returns the backend sessionId on success; throws on failure
 * (the session is already marked as "error" in the store).
 */
export async function startSession(
  connectionConfig: ConnectionConfig,
  connectionName: string,
): Promise<string> {
  const placeholderId = `connecting-${crypto.randomUUID()}`;
  const added = useSessionStore.getState().addSession({
    sessionId: placeholderId,
    connectionId: connectionConfig.id,
    connectionName,
    status: "connecting",
  });
  if (!added) throw new Error("Maximum sessions reached");

  try {
    const sessionId = await connectFromConfig(connectionConfig);
    useSessionStore.getState().updateSession(placeholderId, {
      sessionId,
      status: "connected",
    });
    return sessionId;
  } catch (err) {
    useSessionStore.getState().updateSession(placeholderId, {
      status: "error",
      error: classifySshError(err),
    });
    throw err;
  }
}
