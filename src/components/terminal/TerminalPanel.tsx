import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useTerminalStore } from "@/stores/terminal-store";
import "@xterm/xterm/css/xterm.css";

interface SshDataPayload {
  sessionId: string;
  data: number[];
}

interface SshDisconnectPayload {
  sessionId: string;
  reason: string;
}

export function TerminalPanel() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const activeSession = useTerminalStore((s) => s.activeSession);
  const updateSessionStatus = useTerminalStore((s) => s.updateSessionStatus);

  const handleResize = useCallback(() => {
    const fitAddon = fitAddonRef.current;
    const session = useTerminalStore.getState().activeSession;
    if (!fitAddon || !session) return;

    fitAddon.fit();
    const term = xtermRef.current;
    if (!term) return;

    invoke("ssh_resize", {
      sessionId: session.sessionId,
      cols: term.cols,
      rows: term.rows,
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!terminalRef.current || !activeSession) return;

    const term = new Terminal({
      theme: {
        background: "#1e1e2e",
        foreground: "#cdd6f4",
        cursor: "#f5e0dc",
        selectionBackground: "#585b70",
        black: "#45475a",
        red: "#f38ba8",
        green: "#a6e3a1",
        yellow: "#f9e2af",
        blue: "#89b4fa",
        magenta: "#f5c2e7",
        cyan: "#94e2d5",
        white: "#bac2de",
        brightBlack: "#585b70",
        brightRed: "#f38ba8",
        brightGreen: "#a6e3a1",
        brightYellow: "#f9e2af",
        brightBlue: "#89b4fa",
        brightMagenta: "#f5c2e7",
        brightCyan: "#94e2d5",
        brightWhite: "#a6adc8",
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      fontSize: 14,
      cursorBlink: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);

    try {
      const webglAddon = new WebglAddon();
      term.loadAddon(webglAddon);
    } catch {
      // WebGL not available, fall back to canvas renderer
    }

    fitAddon.fit();
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Send initial resize
    invoke("ssh_resize", {
      sessionId: activeSession.sessionId,
      cols: term.cols,
      rows: term.rows,
    }).catch(console.error);

    // User input → SSH
    const dataDisposable = term.onData((data) => {
      const session = useTerminalStore.getState().activeSession;
      if (!session) return;
      const encoder = new TextEncoder();
      invoke("ssh_write", {
        sessionId: session.sessionId,
        data: Array.from(encoder.encode(data)),
      }).catch(console.error);
    });

    // SSH data → Terminal
    let unlistenData: UnlistenFn | undefined;
    let unlistenDisconnect: UnlistenFn | undefined;

    const setupListeners = async () => {
      unlistenData = await listen<SshDataPayload>("ssh-data", (event) => {
        const session = useTerminalStore.getState().activeSession;
        if (event.payload.sessionId === session?.sessionId) {
          term.write(new Uint8Array(event.payload.data));
        }
      });

      unlistenDisconnect = await listen<SshDisconnectPayload>(
        "ssh-disconnect",
        (event) => {
          const session = useTerminalStore.getState().activeSession;
          if (event.payload.sessionId === session?.sessionId) {
            updateSessionStatus(event.payload.sessionId, "disconnected");
            term.write("\r\n\x1b[31m[Disconnected]\x1b[0m\r\n");
          }
        },
      );
    };

    setupListeners();

    // Handle resize
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(terminalRef.current);

    return () => {
      dataDisposable.dispose();
      unlistenData?.();
      unlistenDisconnect?.();
      resizeObserver.disconnect();
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, [activeSession, handleResize, updateSessionStatus]);

  if (!activeSession) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">
          Connect to a server to start a terminal session
        </p>
      </div>
    );
  }

  return <div ref={terminalRef} className="h-full w-full" />;
}
