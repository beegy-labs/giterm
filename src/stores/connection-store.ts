import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AuthMethod = "password" | "private-key";

export interface ConnectionConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
}

interface ConnectionState {
  connections: ConnectionConfig[];
  addConnection: (connection: ConnectionConfig) => void;
  removeConnection: (id: string) => void;
  updateConnection: (id: string, updates: Partial<ConnectionConfig>) => void;
  getConnection: (id: string) => ConnectionConfig | undefined;
}

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set, get) => ({
      connections: [],
      addConnection: (connection) =>
        set((state) => ({
          connections: [...state.connections, connection],
        })),
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
    }),
    {
      name: "giterm-connections",
    },
  ),
);
