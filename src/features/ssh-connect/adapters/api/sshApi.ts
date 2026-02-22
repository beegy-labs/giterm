import { invoke } from "@tauri-apps/api/core";
import type { ConnectionConfig } from "@/entities/connection";

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

const CONNECT_TIMEOUT_MS = 15_000;

export async function sshConnect(config: SshConnectConfig): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);

  try {
    const result = await Promise.race([
      invoke<string>("ssh_connect", { config }),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () =>
          reject(new Error("Connection timeout")),
        );
      }),
    ]);
    return result;
  } finally {
    clearTimeout(timer);
  }
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
  const config = buildSshConfig(conn);
  return sshConnect(config);
}

export async function sshWrite(sessionId: string, data: string): Promise<void> {
  const encoder = new TextEncoder();
  return invoke("ssh_write", {
    sessionId,
    data: Array.from(encoder.encode(data)),
  });
}

export async function sshResize(
  sessionId: string,
  cols: number,
  rows: number,
): Promise<void> {
  return invoke("ssh_resize", { sessionId, cols, rows });
}

export async function sshDisconnect(sessionId: string): Promise<void> {
  return invoke("ssh_disconnect", { sessionId });
}

export async function sshExec(
  sessionId: string,
  command: string,
): Promise<string> {
  return invoke("ssh_exec", { sessionId, command });
}

export async function sshTestConnection(
  conn: ConnectionConfig,
): Promise<void> {
  const config = buildSshConfig(conn);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);

  try {
    await Promise.race([
      invoke<void>("ssh_test_connection", { config }),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () =>
          reject(new Error("Connection timeout")),
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
