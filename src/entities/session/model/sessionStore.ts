import { create } from "zustand";

export type SessionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "error";

export interface TerminalSession {
  sessionId: string;
  connectionId: string;
  connectionName: string;
  status: SessionStatus;
  error?: string;
  reconnectAttempt?: number;
}

const MAX_SESSIONS = 5;

interface SessionState {
  sessions: TerminalSession[];
  activeIndex: number;

  /** Computed: currently active session (or null) */
  activeSession: TerminalSession | null;

  addSession: (session: TerminalSession) => boolean;
  removeSession: (sessionId: string) => void;
  setActiveIndex: (index: number) => void;
  setActiveBySessionId: (sessionId: string) => void;
  reorderSessions: (fromIndex: number, toIndex: number) => void;
  updateSession: (
    sessionId: string,
    updates: Partial<TerminalSession>,
  ) => void;
  updateSessionStatus: (
    sessionId: string,
    status: SessionStatus,
    error?: string,
  ) => void;
  canAddMore: () => boolean;
  getSessionByConnectionId: (connectionId: string) => TerminalSession | undefined;

  /** @deprecated Use addSession / removeSession instead */
  setActiveSession: (session: TerminalSession | null) => void;
}

function computeActiveSession(
  sessions: TerminalSession[],
  activeIndex: number,
): TerminalSession | null {
  if (sessions.length === 0) return null;
  return sessions[Math.min(activeIndex, sessions.length - 1)] ?? null;
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  sessions: [],
  activeIndex: 0,

  get activeSession() {
    const state = get();
    return computeActiveSession(state.sessions, state.activeIndex);
  },

  addSession: (session) => {
    const state = get();
    if (state.sessions.length >= MAX_SESSIONS) return false;
    const newSessions = [...state.sessions, session];
    set({
      sessions: newSessions,
      activeIndex: newSessions.length - 1,
      activeSession: session,
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
      activeSession: computeActiveSession(newSessions, newIndex),
    });
  },

  setActiveIndex: (index) => {
    const state = get();
    if (index < 0 || index >= state.sessions.length) return;
    set({
      activeIndex: index,
      activeSession: state.sessions[index],
    });
  },

  setActiveBySessionId: (sessionId) => {
    const state = get();
    const idx = state.sessions.findIndex((s) => s.sessionId === sessionId);
    if (idx !== -1) {
      set({
        activeIndex: idx,
        activeSession: state.sessions[idx],
      });
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
      activeSession: computeActiveSession(newSessions, newIndex),
    });
  },

  updateSession: (sessionId, updates) => {
    set((state) => {
      const newSessions = state.sessions.map((s) =>
        s.sessionId === sessionId ? { ...s, ...updates } : s,
      );
      return {
        sessions: newSessions,
        activeSession: computeActiveSession(newSessions, state.activeIndex),
      };
    });
  },

  updateSessionStatus: (sessionId, status, error) => {
    set((state) => {
      const newSessions = state.sessions.map((s) =>
        s.sessionId === sessionId ? { ...s, status, error } : s,
      );
      return {
        sessions: newSessions,
        activeSession: computeActiveSession(newSessions, state.activeIndex),
      };
    });
  },

  canAddMore: () => get().sessions.length < MAX_SESSIONS,

  getSessionByConnectionId: (connectionId) =>
    get().sessions.find((s) => s.connectionId === connectionId),

  // Backwards-compatible setter — replaces all sessions with a single one (or clears)
  setActiveSession: (session) => {
    if (!session) {
      set({ sessions: [], activeIndex: 0, activeSession: null });
    } else {
      set({
        sessions: [session],
        activeIndex: 0,
        activeSession: session,
      });
    }
  },
}));
