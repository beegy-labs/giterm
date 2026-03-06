import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { tauriStorage } from "@/shared/adapters/tauriStorage";
import {
  credentialStore,
  credentialGet,
  credentialDeleteAll,
} from "@/shared/adapters/credentialApi";
import { MAX_CONNECTIONS } from "@/shared/lib/constants";

export type AuthMethod = "password" | "private-key";

export interface ConnectionConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
  password?: string;
  keyPath?: string;
  passphrase?: string;
  startupCommand?: string;
  jumpHost?: string;
  jumpPort?: number;
  jumpUsername?: string;
  jumpAuthMethod?: AuthMethod;
  jumpPassword?: string;
  jumpKeyPath?: string;
  jumpPassphrase?: string;
}

/** Fields that contain secrets — stripped before persistence.
 * Keep in sync with ALLOWED_FIELDS in src-tauri/src/commands/credential.rs */
const SECRET_FIELDS = [
  "password",
  "passphrase",
  "jumpPassword",
  "jumpPassphrase",
] as const;

/** Strip secrets from a connection config for safe persistence. */
function stripSecrets(conn: ConnectionConfig): ConnectionConfig {
  const clean = { ...conn };
  for (const field of SECRET_FIELDS) {
    delete (clean as Record<string, unknown>)[field];
  }
  return clean;
}

/** Save secrets to OS keychain. Non-blocking, fire-and-forget. */
async function saveSecrets(conn: ConnectionConfig): Promise<void> {
  for (const field of SECRET_FIELDS) {
    const value = conn[field];
    if (value) {
      await credentialStore(conn.id, field, value).catch(console.error);
    }
  }
}

/** Load secrets from OS keychain into a connection config. */
export async function loadSecrets(
  conn: ConnectionConfig,
): Promise<ConnectionConfig> {
  const enriched = { ...conn };
  for (const field of SECRET_FIELDS) {
    try {
      const value = await credentialGet(conn.id, field);
      if (value) {
        (enriched as Record<string, unknown>)[field] = value;
      }
    } catch {
      // Keychain not available (e.g. browser dev) — skip
    }
  }
  return enriched;
}

interface ConnectionState {
  connections: ConnectionConfig[];
  addConnection: (connection: ConnectionConfig) => void;
  removeConnection: (id: string) => void;
  updateConnection: (id: string, updates: Partial<ConnectionConfig>) => void;
  duplicateConnection: (id: string) => void;
}

/** Selector: find a connection by id. Usage: `selectConnectionById(id)(state)` */
export const selectConnectionById =
  (id: string) => (state: ConnectionState) =>
    state.connections.find((c) => c.id === id);

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set, get) => ({
      connections: [],
      addConnection: (connection) => {
        set((state) => {
          if (state.connections.length >= MAX_CONNECTIONS) return state;
          saveSecrets(connection);
          return { connections: [...state.connections, connection] };
        });
      },
      removeConnection: (id) => {
        credentialDeleteAll(id).catch(console.error);
        set((state) => ({
          connections: state.connections.filter((c) => c.id !== id),
        }));
      },
      updateConnection: (id, updates) => {
        // If updates contain secrets, save them to keychain
        const conn = get().connections.find((c) => c.id === id);
        if (conn) {
          const merged = { ...conn, ...updates };
          saveSecrets(merged);
        }
        set((state) => ({
          connections: state.connections.map((c) =>
            c.id === id ? { ...c, ...updates } : c,
          ),
        }));
      },
      duplicateConnection: (id) => {
        const conn = get().connections.find((c) => c.id === id);
        if (!conn || get().connections.length >= MAX_CONNECTIONS) return;
        const dup = stripSecrets({
          ...conn,
          id: crypto.randomUUID(),
          name: `${conn.name} (Copy)`,
        });
        // Duplicate does NOT copy secrets — user must re-enter
        set((state) => ({ connections: [...state.connections, dup] }));
      },
    }),
    {
      name: "giterm-connections",
      storage: createJSONStorage(() => tauriStorage),
      partialize: (state) => ({
        ...state,
        connections: state.connections.map(stripSecrets),
      }),
    },
  ),
);
