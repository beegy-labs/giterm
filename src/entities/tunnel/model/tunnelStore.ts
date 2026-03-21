import { create } from "zustand";
import { MAX_TUNNELS } from "@/shared/lib/constants";

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
  addTunnel: (tunnel: TunnelConfig) => boolean;
  removeTunnel: (id: string) => void;
  updateTunnel: (id: string, updates: Partial<TunnelConfig>) => void;
}

export const useTunnelStore = create<TunnelState>()((set, get) => ({
  tunnels: [],

  addTunnel: (tunnel) => {
    const state = get();
    if (state.tunnels.length >= MAX_TUNNELS) return false;
    set({ tunnels: [...state.tunnels, tunnel] });
    return true;
  },

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

}));
