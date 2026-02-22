import { create } from "zustand";

export type TunnelStatus = "active" | "stopped" | "error";

export interface TunnelConfig {
  id: string;
  name: string;
  connectionId: string;
  sessionId: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
  status: TunnelStatus;
  error?: string;
}

interface TunnelState {
  tunnels: TunnelConfig[];
  addTunnel: (tunnel: TunnelConfig) => void;
  removeTunnel: (id: string) => void;
  updateTunnel: (id: string, updates: Partial<TunnelConfig>) => void;
  getTunnelsBySession: (sessionId: string) => TunnelConfig[];
}

export const useTunnelStore = create<TunnelState>()((set, get) => ({
  tunnels: [],

  addTunnel: (tunnel) =>
    set((state) => ({ tunnels: [...state.tunnels, tunnel] })),

  removeTunnel: (id) =>
    set((state) => ({
      tunnels: state.tunnels.filter((t) => t.id !== id),
    })),

  updateTunnel: (id, updates) =>
    set((state) => ({
      tunnels: state.tunnels.map((t) =>
        t.id === id ? { ...t, ...updates } : t,
      ),
    })),

  getTunnelsBySession: (sessionId) =>
    get().tunnels.filter((t) => t.sessionId === sessionId),
}));
