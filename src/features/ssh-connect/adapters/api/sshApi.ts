import { invoke } from "@tauri-apps/api/core";
import { loadSecrets, type ConnectionConfig } from "@/entities/connection";

interface PasswordAuth {
  type: "password";
  password: string;
}

interface PrivateKeyAuth {
  type: "privateKey";
  keyPath: string;
  passphrase: string | null;
}

interface SshConnectConfig {
  host: string;
  port: number;
  username: string;
  authMethod: PasswordAuth | PrivateKeyAuth;
  startupCommand?: string | null;
  jumpHost?: string | null;
  jumpPort?: number | null;
  jumpUsername?: string | null;
  jumpAuthMethod?: PasswordAuth | PrivateKeyAuth | null;
}

const CONNECT_TIMEOUT_MS = 65_000;

function withTimeout<T>(promise: Promise<T>, ms = CONNECT_TIMEOUT_MS): Promise<T> {
  let timerId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => reject(new Error("Connection timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timerId));
}

export function sshConnect(config: SshConnectConfig): Promise<string> {
  return withTimeout(invoke<string>("ssh_connect", { config }));
}

function buildAuthMethod(
  method: "password" | "private-key",
  password?: string,
  keyPath?: string,
  passphrase?: string,
): PasswordAuth | PrivateKeyAuth {
  return method === "password"
    ? { type: "password" as const, password: password ?? "" }
    : {
        type: "privateKey" as const,
        keyPath: keyPath ?? "",
        passphrase: passphrase ?? null,
      };
}

function buildSshConfig(conn: ConnectionConfig): SshConnectConfig {
  const config: SshConnectConfig = {
    host: conn.host,
    port: conn.port,
    username: conn.username,
    startupCommand: conn.startupCommand ?? null,
    authMethod: buildAuthMethod(
      conn.authMethod,
      conn.password,
      conn.keyPath,
      conn.passphrase,
    ),
  };

  if (conn.jumpHost) {
    config.jumpHost = conn.jumpHost;
    config.jumpPort = conn.jumpPort ?? null;
    config.jumpUsername = conn.jumpUsername ?? null;
    if (conn.jumpAuthMethod) {
      config.jumpAuthMethod = buildAuthMethod(
        conn.jumpAuthMethod,
        conn.jumpPassword,
        conn.jumpKeyPath,
        conn.jumpPassphrase,
      );
    }
  }

  return config;
}

export function classifySshError(err: unknown): string {
  const raw = String(err);
  if (raw.includes("Authentication")) return "Invalid credentials";
  if (raw.includes("timeout") || raw.includes("Timeout"))
    return "Connection timeout";
  if (raw.includes("refused") || raw.includes("connect"))
    return "Cannot reach host";
  return "Connection failed";
}

export async function connectFromConfig(
  conn: ConnectionConfig,
): Promise<string> {
  // Load secrets from OS keychain before building the SSH config
  const enriched = await loadSecrets(conn);
  const config = buildSshConfig(enriched);
  return sshConnect(config);
}

export async function sshWrite(sessionId: string, data: string): Promise<void> {
  return invoke("ssh_write", {
    sessionId,
    data: Array.from(new TextEncoder().encode(data)),
  });
}

const lastResizeCache = new Map<string, string>();

export async function sshResize(
  sessionId: string,
  cols: number,
  rows: number,
): Promise<void> {
  const key = `${cols}x${rows}`;
  if (lastResizeCache.get(sessionId) === key) return;
  lastResizeCache.set(sessionId, key);
  return invoke("ssh_resize", { sessionId, cols, rows });
}

export async function sshDisconnect(sessionId: string): Promise<void> {
  lastResizeCache.delete(sessionId);
  return invoke("ssh_disconnect", { sessionId });
}

export async function sshHostKeyVerifyRespond(
  sessionId: string,
  accepted: boolean,
): Promise<void> {
  return invoke("ssh_host_key_verify_respond", { sessionId, accepted });
}

export async function sshTestConnection(
  conn: ConnectionConfig,
): Promise<void> {
  const enriched = await loadSecrets(conn);
  const config = buildSshConfig(enriched);
  await withTimeout(invoke<void>("ssh_test_connection", { config }));
}
