import { useEffect } from "react";
import { useSessionStore } from "@/entities/session";
import { useConnectDialogStore } from "@/features/ssh-connect";
import { useTerminalSettingsStore } from "@/entities/session/model/terminalSettingsStore";
import { sshDisconnect } from "@/features/ssh-connect";

export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      // Mod+T — open connection dialog
      if (e.key === "t") {
        e.preventDefault();
        useConnectDialogStore.getState().setOpen(true);
        return;
      }

      // Mod+W — close current tab
      if (e.key === "w") {
        e.preventDefault();
        const session = useSessionStore.getState().activeSession;
        if (session) {
          if (session.status === "connected") {
            sshDisconnect(session.sessionId).catch(console.error);
          }
          useSessionStore.getState().removeSession(session.sessionId);
        }
        return;
      }

      // Mod+1-5 — switch to tab n
      if (e.key >= "1" && e.key <= "5") {
        e.preventDefault();
        const idx = parseInt(e.key, 10) - 1;
        const state = useSessionStore.getState();
        if (idx < state.sessions.length) {
          state.setActiveIndex(idx);
        }
        return;
      }

      // Mod+[ — previous tab
      if (e.key === "[") {
        e.preventDefault();
        const state = useSessionStore.getState();
        if (state.activeIndex > 0) {
          state.setActiveIndex(state.activeIndex - 1);
        }
        return;
      }

      // Mod+] — next tab
      if (e.key === "]") {
        e.preventDefault();
        const state = useSessionStore.getState();
        if (state.activeIndex < state.sessions.length - 1) {
          state.setActiveIndex(state.activeIndex + 1);
        }
        return;
      }

      // Mod+= / Mod++ — increase font size
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        useTerminalSettingsStore.getState().increase();
        return;
      }

      // Mod+- — decrease font size
      if (e.key === "-") {
        e.preventDefault();
        useTerminalSettingsStore.getState().decrease();
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
