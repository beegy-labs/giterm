import { create } from "zustand";
import { MAX_SESSIONS } from "@/shared/lib/constants";
import type { SessionStatus } from "@/shared/lib/types";

export type { SessionStatus };

export interface TerminalSession {
  sessionId: string;
  connectionId: string;
  connectionName: string;
  status: SessionStatus;
  error?: string;
}

export { MAX_SESSIONS };

interface SessionState {
  sessions: TerminalSession[];
  activeIndex: number;

  addSession: (session: TerminalSession) => boolean;
  removeSession: (sessionId: string) => void;
  setActiveIndex: (index: number) => void;
  setActiveBySessionId: (sessionId: string) => void;
  reorderSessions: (fromIndex: number, toIndex: number) => void;
  updateSession: (
    sessionId: string,
    updates: Partial<TerminalSession>,
  ) => void;
}

function computeActiveSession(
  sessions: TerminalSession[],
  activeIndex: number,
): TerminalSession | null {
  if (sessions.length === 0) return null;
  return sessions[Math.min(activeIndex, sessions.length - 1)] ?? null;
}

export const selectActiveSession = (s: SessionState): TerminalSession | null =>
  computeActiveSession(s.sessions, s.activeIndex);

export const useSessionStore = create<SessionState>()((set, get) => ({
  sessions: [],
  activeIndex: 0,

  addSession: (session) => {
    const state = get();
    if (state.sessions.length >= MAX_SESSIONS) return false;
    const newSessions = [...state.sessions, session];
    set({
      sessions: newSessions,
      activeIndex: newSessions.length - 1,
    });
    return true;
  },

  removeSession: (sessionId) => {
    const state = get();
    const idx = state.sessions.findIndex((s) => s.sessionId === sessionId);
    if (idx === -1) return;

    const newSessions = state.sessions.filter((s) => s.sessionId !== sessionId);
    let newIndex = state.activeIndex;
    if (newSessions.length === 0) {
      newIndex = 0;
    } else if (state.activeIndex >= newSessions.length) {
      newIndex = newSessions.length - 1;
    } else if (state.activeIndex > idx) {
      newIndex = state.activeIndex - 1;
    }

    set({
      sessions: newSessions,
      activeIndex: newIndex,
    });
  },

  setActiveIndex: (index) => {
    const state = get();
    if (index < 0 || index >= state.sessions.length) return;
    set({ activeIndex: index });
  },

  setActiveBySessionId: (sessionId) => {
    const state = get();
    const idx = state.sessions.findIndex((s) => s.sessionId === sessionId);
    if (idx !== -1) {
      set({ activeIndex: idx });
    }
  },

  reorderSessions: (fromIndex, toIndex) => {
    const state = get();
    if (
      fromIndex < 0 ||
      fromIndex >= state.sessions.length ||
      toIndex < 0 ||
      toIndex >= state.sessions.length
    )
      return;

    const newSessions = [...state.sessions];
    const [moved] = newSessions.splice(fromIndex, 1) as [TerminalSession];
    newSessions.splice(toIndex, 0, moved);

    // Track the active session through the reorder
    let newIndex = state.activeIndex;
    if (state.activeIndex === fromIndex) {
      newIndex = toIndex;
    } else if (
      fromIndex < state.activeIndex &&
      toIndex >= state.activeIndex
    ) {
      newIndex = state.activeIndex - 1;
    } else if (
      fromIndex > state.activeIndex &&
      toIndex <= state.activeIndex
    ) {
      newIndex = state.activeIndex + 1;
    }

    set({
      sessions: newSessions,
      activeIndex: newIndex,
    });
  },

  updateSession: (sessionId, updates) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.sessionId === sessionId ? { ...s, ...updates } : s,
      ),
    }));
  },


}));

export const selectSessionByConnectionId =
  (connectionId: string) => (state: SessionState) =>
    state.sessions.find((s) => s.connectionId === connectionId);
