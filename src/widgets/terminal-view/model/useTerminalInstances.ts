import { useEffect, useRef, type RefObject } from "react";
import { Terminal as XTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { sshResize } from "@/features/ssh-connect";
import { terminalTheme } from "@/shared/config/designTokens";
import type { TerminalSession } from "@/entities/session";
import type { HiddenImeInputHandle } from "../ui/HiddenImeInput";
import type { TermInstance } from "./types";

export function useTerminalInstances(args: {
  sessions: TerminalSession[];
  activeSessionId: string | undefined;
  isMobile: boolean;
  fontSize: number;
  imeInputRef: RefObject<HiddenImeInputHandle | null>;
}): {
  containerRef: RefObject<HTMLDivElement | null>;
  instancesRef: React.MutableRefObject<Map<string, TermInstance>>;
} {
  const { sessions, activeSessionId, isMobile, fontSize, imeInputRef } = args;
  const containerRef = useRef<HTMLDivElement>(null);
  const instancesRef = useRef<Map<string, TermInstance>>(new Map());

  // Create/destroy xterm instances as sessions come and go
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const currentIds = new Set(
      sessions
        .filter(
          (s) =>
            (s.status === "connected" || s.status === "disconnected" || s.status === "reconnecting") &&
            s.sessionId.length > 0 &&
            !s.sessionId.startsWith("connecting-"),
        )
        .map((s) => s.sessionId),
    );

    // Create new instances
    for (const id of currentIds) {
      if (instancesRef.current.has(id)) continue;

      const termEl = document.createElement("div");
      termEl.style.width = "100%";
      termEl.style.height = "100%";
      termEl.style.display = "none";
      termEl.style.position = "absolute";
      termEl.style.top = "0";
      termEl.style.left = "0";
      container.appendChild(termEl);

      const term = new XTerminal({
        theme: terminalTheme,
        fontFamily:
          "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontSize: isMobile ? 12 : fontSize,
        scrollback: isMobile ? 1000 : 5000,
        cursorBlink: true,
        allowProposedApi: true,
        disableStdin: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(termEl);

      let webgl: import("@xterm/addon-webgl").WebglAddon | null = null;
      try {
        const webglAddon = new WebglAddon();
        webglAddon.onContextLoss(() => {
          webglAddon.dispose();
          const inst = instancesRef.current.get(id);
          if (inst) inst.webglAddon = null;
        });
        term.loadAddon(webglAddon);
        webgl = webglAddon;
      } catch {
        // WebGL not available
      }

      instancesRef.current.set(id, {
        terminal: term,
        fitAddon,
        webglAddon: webgl,
        containerEl: termEl,
      });
    }

    // Migrate orphaned instances when sessionId changes (e.g. after reconnect).
    // An orphaned instance is one in instancesRef whose key no longer matches
    // any session, while a session exists whose ID is not yet in instancesRef.
    const orphanedIds: string[] = [];
    for (const id of instancesRef.current.keys()) {
      if (!currentIds.has(id)) {
        orphanedIds.push(id);
      }
    }
    const unmatchedSessionIds: string[] = [];
    for (const id of currentIds) {
      if (!instancesRef.current.has(id)) {
        unmatchedSessionIds.push(id);
      }
    }
    // Match orphans to unmatched sessions by connectionId order.
    // After reconnect there is typically exactly one orphan ↔ one new ID.
    if (orphanedIds.length > 0 && unmatchedSessionIds.length > 0) {
      const sessionsByOldId = new Map(
        sessions.map((s) => [s.sessionId, s]),
      );
      for (const newId of unmatchedSessionIds) {
        const newSession = sessionsByOldId.get(newId);
        if (!newSession) continue;
        // Pair by order (1:1 reconnect) — orphan's old session no longer in store
        if (orphanedIds.length > 0) {
          const oldId = orphanedIds.shift()!;
          const inst = instancesRef.current.get(oldId)!;
          instancesRef.current.delete(oldId);
          instancesRef.current.set(newId, inst);
        }
      }
    }

    // Destroy remaining orphaned instances (truly removed sessions)
    for (const [id, inst] of instancesRef.current) {
      if (!currentIds.has(id)) {
        inst.webglAddon?.dispose();
        inst.terminal.dispose();
        inst.containerEl.remove();
        instancesRef.current.delete(id);
      }
    }
  }, [sessions, isMobile]);

  // Show/hide based on active session, and fit
  useEffect(() => {
    for (const [id, inst] of instancesRef.current) {
      if (id === activeSessionId) {
        inst.containerEl.style.display = "block";
        requestAnimationFrame(() => {
          inst.fitAddon.fit();
          sshResize(id, inst.terminal.cols, inst.terminal.rows).catch(
            console.error,
          );
        });
      } else {
        inst.containerEl.style.display = "none";
      }
    }
    // Focus IME input on tab switch
    if (activeSessionId) {
      const tid = setTimeout(() => imeInputRef.current?.focus(), 50);
      return () => clearTimeout(tid);
    }
  }, [activeSessionId, imeInputRef]);

  // Resize observer — fit() immediately, debounce sshResize() IPC.
  // iOS keyboard animation fires many resize events over ~300ms. Debouncing
  // fit() by 150ms caused a ~450ms delay where the terminal layout was wrong
  // and touch/keyboard input didn't work until the resize settled.
  // fit() is a fast local DOM operation; sshResize() is IPC (has dedup cache).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      if (!activeSessionId) return;
      const inst = instancesRef.current.get(activeSessionId);
      if (!inst) return;

      // Immediate fit — terminal layout updates without delay
      inst.fitAddon.fit();

      // Debounce sshResize IPC (has dedup cache, skips if cols/rows unchanged)
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        sshResize(
          activeSessionId,
          inst.terminal.cols,
          inst.terminal.rows,
        ).catch(console.error);
      }, 150);
    });

    observer.observe(container);
    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      observer.disconnect();
    };
  }, [activeSessionId]);

  // Update font size across all instances when it changes
  useEffect(() => {
    if (isMobile) return;
    for (const [id, inst] of instancesRef.current) {
      inst.terminal.options.fontSize = fontSize;
      inst.fitAddon.fit();
      if (id === activeSessionId) {
        sshResize(id, inst.terminal.cols, inst.terminal.rows).catch(
          console.error,
        );
      }
    }
  }, [fontSize, isMobile, activeSessionId]);

  // Cleanup all instances on unmount
  useEffect(() => {
    return () => {
      for (const [, inst] of instancesRef.current) {
        inst.webglAddon?.dispose();
        inst.terminal.dispose();
        inst.containerEl.remove();
      }
      instancesRef.current.clear();
    };
  }, []);

  return { containerRef, instancesRef };
}
