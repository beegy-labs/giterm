import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { tauriStorage } from "@/shared/lib/tauriStorage";

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

const MAX_CONNECTIONS = 5;

interface ConnectionState {
  connections: ConnectionConfig[];
  canAddMore: () => boolean;
  addConnection: (connection: ConnectionConfig) => void;
  removeConnection: (id: string) => void;
  updateConnection: (id: string, updates: Partial<ConnectionConfig>) => void;
  getConnection: (id: string) => ConnectionConfig | undefined;
  duplicateConnection: (id: string) => void;
}

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set, get) => ({
      connections: [],
      canAddMore: () => get().connections.length < MAX_CONNECTIONS,
      addConnection: (connection) =>
        set((state) => {
          if (state.connections.length >= MAX_CONNECTIONS) return state;
          return { connections: [...state.connections, connection] };
        }),
      removeConnection: (id) =>
        set((state) => ({
          connections: state.connections.filter((c) => c.id !== id),
        })),
      updateConnection: (id, updates) =>
        set((state) => ({
          connections: state.connections.map((c) =>
            c.id === id ? { ...c, ...updates } : c,
          ),
        })),
      getConnection: (id) => get().connections.find((c) => c.id === id),
      duplicateConnection: (id) => {
        const conn = get().connections.find((c) => c.id === id);
        if (!conn || get().connections.length >= MAX_CONNECTIONS) return;
        const dup = {
          ...conn,
          id: crypto.randomUUID(),
          name: `${conn.name} (Copy)`,
        };
        set((state) => ({ connections: [...state.connections, dup] }));
      },
    }),
    {
      name: "giterm-connections",
      storage: createJSONStorage(() => tauriStorage),
    },
  ),
);
