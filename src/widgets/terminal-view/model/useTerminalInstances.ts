import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Terminal as XTerminal } from "@xterm/xterm";
import { CanvasAddon } from "@xterm/addon-canvas";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { sshResize } from "@/features/ssh-connect";
import type { TerminalSession } from "@/entities/session";
import type { HiddenImeInputHandle } from "../ui/HiddenImeInput";
import type { TermInstance } from "./types";

const DEFAULT_XTERM_THEME = {
  background: "#000000",
  foreground: "#ffffff",
  cursor: "#ffffff",
  cursorAccent: "#000000",
  selectionBackground: "rgba(255, 255, 255, 0.3)",
  black: "#2e3436",
  red: "#cc0000",
  green: "#4e9a06",
  yellow: "#c4a000",
  blue: "#3465a4",
  magenta: "#75507b",
  cyan: "#06989a",
  white: "#d3d7cf",
  brightBlack: "#555753",
  brightRed: "#ef2929",
  brightGreen: "#8ae234",
  brightYellow: "#fce94f",
  brightBlue: "#729fcf",
  brightMagenta: "#ad7fa8",
  brightCyan: "#34e2e2",
  brightWhite: "#eeeeec",
} as const;

const FALLBACK_XTERM_STYLE_ID = "giterm-xterm-dom-fallback";

function setTerminalVisibility(el: HTMLDivElement, visible: boolean): void {
  el.style.display = "block";
  el.style.visibility = visible ? "visible" : "hidden";
  el.style.pointerEvents = visible ? "auto" : "none";
}

function ensureXtermDomFallback(term: XTerminal): void {
  const host = term.element;
  if (!host) return;

  host.style.backgroundColor = DEFAULT_XTERM_THEME.background;
  host.style.color = DEFAULT_XTERM_THEME.foreground;

  for (const selector of [".xterm-viewport", ".xterm-screen", ".xterm-rows"]) {
    const el = host.querySelector<HTMLElement>(selector);
    if (!el) continue;
    el.style.backgroundColor = DEFAULT_XTERM_THEME.background;
    el.style.color = DEFAULT_XTERM_THEME.foreground;
    el.style.opacity = "1";
    el.style.filter = "none";
  }

  const rows = host.querySelector<HTMLElement>(".xterm-rows");
  if (rows) {
    rows.style.whiteSpace = "pre";
    rows.style.pointerEvents = "none";
    rows.style.fontFamily = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace";
  }

  const existing = host.querySelector<HTMLStyleElement>(`#${FALLBACK_XTERM_STYLE_ID}`);
  if (existing) return;

  const style = document.createElement("style");
  style.id = FALLBACK_XTERM_STYLE_ID;
  style.textContent = `
    .xterm .xterm-rows { color: ${DEFAULT_XTERM_THEME.foreground}; }
    .xterm .xterm-rows .xterm-dim { opacity: 1 !important; filter: none !important; }
    .xterm .xterm-rows .xterm-fg-0 { color: ${DEFAULT_XTERM_THEME.black}; }
    .xterm .xterm-rows .xterm-fg-1 { color: ${DEFAULT_XTERM_THEME.red}; }
    .xterm .xterm-rows .xterm-fg-2 { color: ${DEFAULT_XTERM_THEME.green}; }
    .xterm .xterm-rows .xterm-fg-3 { color: ${DEFAULT_XTERM_THEME.yellow}; }
    .xterm .xterm-rows .xterm-fg-4 { color: ${DEFAULT_XTERM_THEME.blue}; }
    .xterm .xterm-rows .xterm-fg-5 { color: ${DEFAULT_XTERM_THEME.magenta}; }
    .xterm .xterm-rows .xterm-fg-6 { color: ${DEFAULT_XTERM_THEME.cyan}; }
    .xterm .xterm-rows .xterm-fg-7 { color: ${DEFAULT_XTERM_THEME.white}; }
    .xterm .xterm-rows .xterm-fg-8 { color: ${DEFAULT_XTERM_THEME.brightBlack}; }
    .xterm .xterm-rows .xterm-fg-9 { color: ${DEFAULT_XTERM_THEME.brightRed}; }
    .xterm .xterm-rows .xterm-fg-10 { color: ${DEFAULT_XTERM_THEME.brightGreen}; }
    .xterm .xterm-rows .xterm-fg-11 { color: ${DEFAULT_XTERM_THEME.brightYellow}; }
    .xterm .xterm-rows .xterm-fg-12 { color: ${DEFAULT_XTERM_THEME.brightBlue}; }
    .xterm .xterm-rows .xterm-fg-13 { color: ${DEFAULT_XTERM_THEME.brightMagenta}; }
    .xterm .xterm-rows .xterm-fg-14 { color: ${DEFAULT_XTERM_THEME.brightCyan}; }
    .xterm .xterm-rows .xterm-fg-15 { color: ${DEFAULT_XTERM_THEME.brightWhite}; }
    .xterm .xterm-rows .xterm-bg-0 { background-color: ${DEFAULT_XTERM_THEME.black}; }
    .xterm .xterm-rows .xterm-bg-1 { background-color: ${DEFAULT_XTERM_THEME.red}; }
    .xterm .xterm-rows .xterm-bg-2 { background-color: ${DEFAULT_XTERM_THEME.green}; }
    .xterm .xterm-rows .xterm-bg-3 { background-color: ${DEFAULT_XTERM_THEME.yellow}; }
    .xterm .xterm-rows .xterm-bg-4 { background-color: ${DEFAULT_XTERM_THEME.blue}; }
    .xterm .xterm-rows .xterm-bg-5 { background-color: ${DEFAULT_XTERM_THEME.magenta}; }
    .xterm .xterm-rows .xterm-bg-6 { background-color: ${DEFAULT_XTERM_THEME.cyan}; }
    .xterm .xterm-rows .xterm-bg-7 { background-color: ${DEFAULT_XTERM_THEME.white}; }
    .xterm .xterm-rows .xterm-bg-8 { background-color: ${DEFAULT_XTERM_THEME.brightBlack}; }
    .xterm .xterm-rows .xterm-bg-9 { background-color: ${DEFAULT_XTERM_THEME.brightRed}; }
    .xterm .xterm-rows .xterm-bg-10 { background-color: ${DEFAULT_XTERM_THEME.brightGreen}; }
    .xterm .xterm-rows .xterm-bg-11 { background-color: ${DEFAULT_XTERM_THEME.brightYellow}; }
    .xterm .xterm-rows .xterm-bg-12 { background-color: ${DEFAULT_XTERM_THEME.brightBlue}; }
    .xterm .xterm-rows .xterm-bg-13 { background-color: ${DEFAULT_XTERM_THEME.brightMagenta}; }
    .xterm .xterm-rows .xterm-bg-14 { background-color: ${DEFAULT_XTERM_THEME.brightCyan}; }
    .xterm .xterm-rows .xterm-bg-15 { background-color: ${DEFAULT_XTERM_THEME.brightWhite}; }
  `;
  host.appendChild(style);
}

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
      termEl.style.position = "absolute";
      termEl.style.top = "0";
      termEl.style.left = "0";
      // Keep xterm mounted in layout after open(). Toggling display:none on iOS
      // can leave only the text layer visible while the canvas renderer drops out.
      setTerminalVisibility(termEl, true);
      container.appendChild(termEl);

      const term = new XTerminal({
        theme: DEFAULT_XTERM_THEME,
        fontFamily:
          "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontSize: isMobile ? 12 : fontSizeRef.current,
        minimumContrastRatio: 4.5,
        scrollback: isMobile ? 1000 : 5000,
        cursorBlink: true,
        allowProposedApi: true,
        disableStdin: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(termEl);

      let canvasAddon: CanvasAddon | null = null;
      if (isMobile) {
        try {
          const mobileCanvasAddon = new CanvasAddon();
          term.loadAddon(mobileCanvasAddon);
          canvasAddon = mobileCanvasAddon;
        } catch {
          // Fall back to xterm's default DOM renderer if canvas initialization fails.
        }
      }

      // iPhone WKWebView can render xterm's DOM tree without fully applying the
      // runtime-generated theme CSS. Normalize the subtree directly so the base
      // terminal appearance does not depend on those injected styles.
      ensureXtermDomFallback(term);
      fitAddon.fit();
      setTerminalVisibility(termEl, id === activeSessionId);

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
        canvasAddon,
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
        inst.canvasAddon?.dispose();
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
        setTerminalVisibility(prevInst.containerEl, false);
      }
    }

    // Show current
    if (activeSessionId) {
      const inst = instancesRef.current.get(activeSessionId);
      if (inst) {
        setTerminalVisibility(inst.containerEl, true);
        requestAnimationFrame(() => {
          ensureXtermDomFallback(inst.terminal);
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
        inst.canvasAddon?.dispose();
        inst.webglAddon?.dispose();
        inst.terminal.dispose();
        inst.containerEl.remove();
      }
      instancesRef.current.clear();
    };
  }, []);

  return { containerRef, instancesRef };
}
