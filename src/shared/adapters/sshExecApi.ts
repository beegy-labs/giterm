import { invoke } from "@tauri-apps/api/core";

export async function sshExec(
  sessionId: string,
  command: string,
): Promise<string> {
  return invoke("ssh_exec", { sessionId, command });
}
