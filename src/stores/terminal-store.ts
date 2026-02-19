import { create } from "zustand";

export type SessionStatus = "connecting" | "connected" | "disconnected" | "error";

export interface TerminalSession {
  sessionId: string;
  connectionId: string;
  status: SessionStatus;
  error?: string;
}

interface TerminalState {
  activeSession: TerminalSession | null;
  setActiveSession: (session: TerminalSession | null) => void;
  updateSessionStatus: (sessionId: string, status: SessionStatus, error?: string) => void;
}

export const useTerminalStore = create<TerminalState>()((set) => ({
  activeSession: null,
  setActiveSession: (session) => set({ activeSession: session }),
  updateSessionStatus: (sessionId, status, error) =>
    set((state) => {
      if (state.activeSession?.sessionId !== sessionId) return state;
      return {
        activeSession: { ...state.activeSession, status, error },
      };
    }),
}));
