import { invoke } from "@tauri-apps/api/core";

export async function tunnelStart(
  tunnelId: string,
  sessionId: string,
  localPort: number,
  remoteHost: string,
  remotePort: number,
): Promise<void> {
  return invoke("tunnel_start", {
    tunnelId,
    sessionId,
    localPort,
    remoteHost,
    remotePort,
  });
}

export async function tunnelStop(tunnelId: string): Promise<void> {
  return invoke("tunnel_stop", { tunnelId });
}
