import { listen, type UnlistenFn } from "@tauri-apps/api/event";

interface SshDataPayload {
  sessionId: string;
  data: number[];
}

interface SshDisconnectPayload {
  sessionId: string;
  reason: string;
}

export function subscribeSshData(
  onData: (sessionId: string, data: Uint8Array) => void,
): Promise<UnlistenFn> {
  return listen<SshDataPayload>("ssh-data", (event) => {
    onData(event.payload.sessionId, new Uint8Array(event.payload.data));
  });
}

export function subscribeSshDisconnect(
  onDisconnect: (sessionId: string, reason: string) => void,
): Promise<UnlistenFn> {
  return listen<SshDisconnectPayload>("ssh-disconnect", (event) => {
    onDisconnect(event.payload.sessionId, event.payload.reason);
  });
}

export interface HostKeyVerifyPayload {
  sessionId: string;
  fingerprint: string;
  status: "unknown" | "changed";
  oldFingerprint: string | null;
}

export function subscribeSshHostKeyVerify(
  onVerify: (payload: HostKeyVerifyPayload) => void,
): Promise<UnlistenFn> {
  return listen<HostKeyVerifyPayload>("ssh-host-key-verify", (event) => {
    onVerify(event.payload);
  });
}
