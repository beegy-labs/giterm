import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Terminal as XTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { sshResize } from "@/features/ssh-connect";
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

  // Fix #6: Stable ref for activeSessionId — avoids recreating ResizeObserver
  const activeSessionIdRef = useRef(activeSessionId);
  activeSessionIdRef.current = activeSessionId;

  // Stable ref for fontSize — used in creation effect without causing re-runs
  const fontSizeRef = useRef(fontSize);
  fontSizeRef.current = fontSize;

  // Fix #5: Track previous active ID for minimal DOM toggling
  const prevActiveIdRef = useRef<string | undefined>(undefined);

  // Fix #3: Stable dependency — only re-run instance lifecycle when the
  // actual set of eligible session IDs changes, not on every status update.
  const sessionIdKey = useMemo(() => {
    return sessions
      .filter(
        (s) =>
          (s.status === "connected" || s.status === "disconnected" || s.status === "reconnecting") &&
          s.sessionId.length > 0 &&
          !s.sessionId.startsWith("connecting-"),
      )
      .map((s) => s.sessionId)
      .join(",");
  }, [sessions]);

  // Create/destroy xterm instances as sessions come and go
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const currentIds = new Set(sessionIdKey ? sessionIdKey.split(",") : []);

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
        theme: { background: "#000000", foreground: "#ffffff" },
        fontFamily:
          "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontSize: isMobile ? 12 : fontSizeRef.current,
        scrollback: isMobile ? 1000 : 5000,
        cursorBlink: true,
        allowProposedApi: true,
        disableStdin: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(termEl);

      // Fix #4: Skip WebGL on mobile — iOS WKWebView has a limited number of
      // WebGL contexts (8~16). Each xterm instance consumes one, and exceeding
      // the limit silently kills older contexts. Canvas2D is sufficient on mobile.
      let webgl: WebglAddon | null = null;
      if (!isMobile) {
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
      }

      instancesRef.current.set(id, {
        terminal: term,
        fitAddon,
        webglAddon: webgl,
        containerEl: termEl,
      });
    }

    // Migrate orphaned instances when sessionId changes (e.g. after reconnect).
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
    if (orphanedIds.length > 0 && unmatchedSessionIds.length > 0) {
      for (const newId of unmatchedSessionIds) {
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
  }, [sessionIdKey, isMobile]);

  // Fix #5 + #7 + #8: Show/hide with minimal DOM writes.
  // Only toggle the two affected containers (prev → hide, next → show) instead
  // of iterating all instances. Fit + sshResize only fire when needed.
  // IME focus is chained inside the same rAF to avoid race with fit().
  useEffect(() => {
    const prevId = prevActiveIdRef.current;
    prevActiveIdRef.current = activeSessionId;

    // Hide previous (only if it changed)
    if (prevId && prevId !== activeSessionId) {
      const prevInst = instancesRef.current.get(prevId);
      if (prevInst) {
        prevInst.containerEl.style.display = "none";
      }
    }

    // Show current
    if (activeSessionId) {
      const inst = instancesRef.current.get(activeSessionId);
      if (inst) {
        inst.containerEl.style.display = "block";
        requestAnimationFrame(() => {
          inst.fitAddon.fit();
          sshResize(activeSessionId, inst.terminal.cols, inst.terminal.rows).catch(
            console.error,
          );
          // Fix #8: Focus IME in same rAF after fit — avoids 50ms setTimeout race
          imeInputRef.current?.focus();
        });
      }
    }
  }, [activeSessionId, imeInputRef]);

  // Fix #6: Stable ResizeObserver — uses ref for activeSessionId so the
  // observer is created once on mount (not recreated on every tab switch).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let fitTimer: ReturnType<typeof setTimeout> | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      if (!activeSessionIdRef.current) return;
      if (!instancesRef.current.has(activeSessionIdRef.current)) return;

      if (fitTimer) clearTimeout(fitTimer);
      fitTimer = setTimeout(() => {
        fitTimer = null;
        // Re-read ref inside debounce — avoids stale closure when user
        // switches tabs during the 100ms debounce window.
        const id = activeSessionIdRef.current;
        if (!id) return;
        const inst = instancesRef.current.get(id);
        if (!inst) return;
        inst.fitAddon.fit();

        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          sshResize(id, inst.terminal.cols, inst.terminal.rows).catch(
            console.error,
          );
        }, 150);
      }, 100);
    });

    observer.observe(container);
    return () => {
      if (fitTimer) clearTimeout(fitTimer);
      if (resizeTimer) clearTimeout(resizeTimer);
      observer.disconnect();
    };
  }, []); // mount-only — activeSessionId accessed via ref

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
