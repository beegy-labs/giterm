import { useSessionStore } from "@/entities/session";
import { useTunnelStore } from "@/entities/tunnel";
import { tunnelStop } from "@/features/tunnel-manage";
import { clearCpuSnapshot } from "@/shared/lib/cpuSnapshotCache";
import { cancelReconnect } from "./useReconnect";
import { sshDisconnect } from "../adapters/api/sshApi";

/**
 * Tear down a session: cancel any pending reconnect, stop associated tunnels,
 * disconnect from the backend if still connected, clear monitoring cache,
 * and remove from store.
 */
export async function closeSession(sessionId: string): Promise<void> {
  cancelReconnect(sessionId);

  // Stop all tunnels associated with this session
  const sessionTunnels = useTunnelStore
    .getState()
    .tunnels.filter((t) => t.sessionId === sessionId);
  await Promise.all(
    sessionTunnels.map((t) =>
      tunnelStop(t.id).catch(console.error),
    ),
  );
  for (const t of sessionTunnels) {
    useTunnelStore.getState().removeTunnel(t.id);
  }

  const session = useSessionStore
    .getState()
    .sessions.find((s) => s.sessionId === sessionId);
  if (session?.status === "connected") {
    await sshDisconnect(sessionId).catch(console.error);
  }
  clearCpuSnapshot(sessionId);
  useSessionStore.getState().removeSession(sessionId);
}
