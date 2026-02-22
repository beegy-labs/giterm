import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal as XTerminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Loader2, AlertCircle, WifiOff } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useSessionStore } from "@/entities/session";
import { sshWrite, sshResize, sshDisconnect } from "@/features/ssh-connect";
import { ESC } from "@/shared/lib/escapeSequences";
import { cancelReconnect, reconnectSession } from "@/features/ssh-reconnect";
import { useTerminalSettingsStore } from "@/entities/session/model/terminalSettingsStore";
import { terminalTheme } from "@/shared/config/designTokens";
import { imeLogAppend, imeLogStart, imeLogStop } from "@/features/ime-log";
import { FontSizeControls } from "./FontSizeControls";
import { useIsMobile } from "@/shared/lib/useIsMobile";
import { KeyboardToolbar } from "./KeyboardToolbar";
import { HiddenImeInput, type HiddenImeInputHandle } from "./HiddenImeInput";
import { ComposingOverlay } from "./ComposingOverlay";
import "@xterm/xterm/css/xterm.css";

interface SshDataPayload {
  sessionId: string;
  data: number[];
}

interface SshDisconnectPayload {
  sessionId: string;
  reason: string;
}

interface TermInstance {
  terminal: XTerminal;
  fitAddon: FitAddon;
  containerEl: HTMLDivElement;
}

interface TerminalViewProps {
  showToolbar?: boolean;
}

export function TerminalView({ showToolbar = false }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imeInputRef = useRef<HiddenImeInputHandle>(null);
  const instancesRef = useRef<Map<string, TermInstance>>(new Map());
  const listenersRef = useRef<{ unlisten: UnlistenFn }[]>([]);
  const activeSession = useSessionStore((s) => s.activeSession);
  const sessions = useSessionStore((s) => s.sessions);
  const isMobile = useIsMobile();
  const fontSize = useTerminalSettingsStore((s) => s.fontSize);

  const [isCtrlActive, setIsCtrlActive] = useState(false);
  const [isAltActive, setIsAltActive] = useState(false);
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [composingText, setComposingText] = useState("");
  const [tmuxMode, setTmuxMode] = useState(false);
  const inTmuxCopyModeRef = useRef(false);
  const didScrollRef = useRef(false);
  const isDev = import.meta.env.DEV;

  const handleReconnect = useCallback(() => {
    if (!activeSession) return;
    reconnectSession(activeSession.sessionId);
  }, [activeSession]);

  const activeSessionId = activeSession?.sessionId;

  // Create/destroy xterm instances as sessions come and go
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const currentIds = new Set(
      sessions
        .filter(
          (s) =>
            (s.status === "connected" || s.status === "disconnected") &&
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

      try {
        const webglAddon = new WebglAddon();
        term.loadAddon(webglAddon);
      } catch {
        // WebGL not available
      }

      instancesRef.current.set(id, {
        terminal: term,
        fitAddon,
        containerEl: termEl,
      });
    }

    // Destroy removed instances
    for (const [id, inst] of instancesRef.current) {
      if (!currentIds.has(id)) {
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
        // Slight delay to let layout settle before fitting
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
      setTimeout(() => imeInputRef.current?.focus(), 50);
    }
  }, [activeSessionId]);

  // Listen for SSH data and disconnect events (single global listener)
  // Refs store unlisten fns to survive StrictMode double-mount & HMR
  const unlistenDataRef = useRef<UnlistenFn | null>(null);
  const unlistenDisconnectRef = useRef<UnlistenFn | null>(null);

  useEffect(() => {
    // Clean up any existing listeners first (handles StrictMode remount & HMR)
    unlistenDataRef.current?.();
    unlistenDisconnectRef.current?.();
    unlistenDataRef.current = null;
    unlistenDisconnectRef.current = null;

    let cancelled = false;

    const setup = async () => {
      const ulData = await listen<SshDataPayload>("ssh-data", (event) => {
        const inst = instancesRef.current.get(event.payload.sessionId);
        if (inst) {
          inst.terminal.write(new Uint8Array(event.payload.data));
        }
      });
      if (cancelled) {
        ulData();
        return;
      }
      unlistenDataRef.current = ulData;

      const ulDisconnect = await listen<SshDisconnectPayload>(
        "ssh-disconnect",
        (event) => {
          const inst = instancesRef.current.get(event.payload.sessionId);
          if (inst) {
            inst.terminal.write("\r\n\x1b[31m[Disconnected]\x1b[0m\r\n");
          }
          // Use getState() to avoid stale closure
          useSessionStore
            .getState()
            .updateSessionStatus(event.payload.sessionId, "disconnected");
        },
      );
      if (cancelled) {
        ulDisconnect();
        return;
      }
      unlistenDisconnectRef.current = ulDisconnect;
    };

    setup();

    return () => {
      cancelled = true;
      unlistenDataRef.current?.();
      unlistenDisconnectRef.current?.();
      unlistenDataRef.current = null;
      unlistenDisconnectRef.current = null;
    };
  }, []); // No deps — runs once, uses refs & getState() for latest values

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (!activeSessionId) return;
      const inst = instancesRef.current.get(activeSessionId);
      if (inst) {
        inst.fitAddon.fit();
        sshResize(
          activeSessionId,
          inst.terminal.cols,
          inst.terminal.rows,
        ).catch(console.error);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
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
        inst.terminal.dispose();
        inst.containerEl.remove();
      }
      instancesRef.current.clear();
      for (const l of listenersRef.current) {
        l.unlisten();
      }
    };
  }, []);

  const sendToSsh = useCallback((data: string) => {
    const session = useSessionStore.getState().activeSession;
    if (!session || !session.sessionId) return;
    sshWrite(session.sessionId, data).catch(console.error);
  }, []);

  /** Exit tmux copy mode by sending 'q' */
  const exitTmuxCopyMode = useCallback(() => {
    if (inTmuxCopyModeRef.current) {
      sendToSsh("q");
      inTmuxCopyModeRef.current = false;
    }
  }, [sendToSsh]);

  const handleImeCommit = useCallback(
    (text: string) => {
      exitTmuxCopyMode();
      sendToSsh(text);
    },
    [sendToSsh, exitTmuxCopyMode],
  );

  const handleImeSpecialKey = useCallback(
    (key: string) => sendToSsh(key),
    [sendToSsh],
  );

  const handleComposingUpdate = useCallback(
    (composing: string) => setComposingText(composing),
    [],
  );

  // Dev only: auto-start IME file logging on mount, stop on unmount
  useEffect(() => {
    if (!isDev) return;
    imeLogStart().catch(console.error);
    return () => {
      imeLogStop().catch(console.error);
    };
  }, [isDev]);

  const handleImeLog = useCallback(
    (line: string) => {
      imeLogAppend(line).catch(console.error);
    },
    [],
  );

  const handleToolbarKey = useCallback(
    (value: string) => {
      if (!value) return;
      // Toolbar backspace: sync with hidden input state
      if (value === ESC.backspace) {
        imeInputRef.current?.handleToolbarBackspace();
        return;
      }
      sendToSsh(value);
    },
    [sendToSsh],
  );

  const handleCopy = useCallback(async () => {
    if (!activeSessionId) return;
    const inst = instancesRef.current.get(activeSessionId);
    const sel = inst?.terminal.getSelection();
    if (!sel) return;
    await navigator.clipboard.writeText(sel);
    inst?.terminal.clearSelection();
  }, [activeSessionId]);

  const handlePaste = useCallback(async () => {
    const text = await navigator.clipboard.readText();
    if (!text) return;
    sendToSsh("\x1b[200~" + text.replace(/\n/g, "\r") + "\x1b[201~");
  }, [sendToSsh]);

  // Scroll gesture → arrow key conversion (mobile)
  const touchStartYRef = useRef<number | null>(null);
  const scrollAccumulatorRef = useRef(0);
  const SCROLL_THRESHOLD = 30; // pixels per arrow key

  // Long-press text selection refs
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef<{
    col: number;
    row: number;
    bufferRow: number;
  } | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const LONG_PRESS_MS = 400;
  const LONG_PRESS_MOVE_TOLERANCE = 8; // px

  /** Convert touch client coords → terminal cell */
  const touchToCell = useCallback(
    (clientX: number, clientY: number) => {
      if (!activeSessionId) return null;
      const inst = instancesRef.current.get(activeSessionId);
      if (!inst) return null;
      const term = inst.terminal;
      const rect = inst.containerEl.getBoundingClientRect();
      const cellWidth = rect.width / term.cols;
      const cellHeight = rect.height / term.rows;
      const col = Math.max(
        0,
        Math.min(Math.floor((clientX - rect.left) / cellWidth), term.cols - 1),
      );
      const row = Math.max(
        0,
        Math.min(
          Math.floor((clientY - rect.top) / cellHeight),
          term.rows - 1,
        ),
      );
      return { col, row, bufferRow: row + term.buffer.active.baseY };
    },
    [activeSessionId],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      imeInputRef.current?.focus();
      const touch = e.touches[0];
      if (e.touches.length === 1 && touch) {
        touchStartYRef.current = touch.clientY;
        scrollAccumulatorRef.current = 0;
        didScrollRef.current = false;
        touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

        // Start long-press timer for text selection
        const cx = touch.clientX;
        const cy = touch.clientY;
        longPressTimerRef.current = setTimeout(() => {
          longPressTimerRef.current = null;
          const cell = touchToCell(cx, cy);
          if (!cell) return;
          isSelectingRef.current = true;
          selectionStartRef.current = cell;
          const inst = activeSessionId
            ? instancesRef.current.get(activeSessionId)
            : null;
          if (inst) {
            inst.terminal.select(cell.col, cell.bufferRow, 1);
          }
        }, LONG_PRESS_MS);
      }
    },
    [touchToCell, activeSessionId],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (touchStartYRef.current === null || e.touches.length !== 1 || !touch)
        return;

      // Cancel long-press if finger moved beyond tolerance
      if (longPressTimerRef.current && touchStartPosRef.current) {
        const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
        const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
        if (dx > LONG_PRESS_MOVE_TOLERANCE || dy > LONG_PRESS_MOVE_TOLERANCE) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }

      // Extend text selection while dragging
      if (isSelectingRef.current && selectionStartRef.current) {
        const inst = activeSessionId
          ? instancesRef.current.get(activeSessionId)
          : null;
        if (inst) {
          const cell = touchToCell(touch.clientX, touch.clientY);
          if (cell) {
            const start = selectionStartRef.current;
            const startOff =
              start.bufferRow * inst.terminal.cols + start.col;
            const endOff = cell.bufferRow * inst.terminal.cols + cell.col;
            const diff = endOff - startOff;
            if (diff >= 0) {
              inst.terminal.select(start.col, start.bufferRow, diff + 1);
            } else {
              inst.terminal.select(cell.col, cell.bufferRow, -diff + 1);
            }
          }
        }
        return; // Don't scroll while selecting
      }

      const deltaY = touchStartYRef.current - touch.clientY;
      scrollAccumulatorRef.current += deltaY;
      touchStartYRef.current = touch.clientY;

      // Auto-enter tmux copy mode on first scroll when tmux mode is ON
      if (
        tmuxMode &&
        !inTmuxCopyModeRef.current &&
        Math.abs(scrollAccumulatorRef.current) >= SCROLL_THRESHOLD
      ) {
        sendToSsh("\x02["); // Ctrl-B + [ → enter copy mode
        inTmuxCopyModeRef.current = true;
      }

      while (Math.abs(scrollAccumulatorRef.current) >= SCROLL_THRESHOLD) {
        if (scrollAccumulatorRef.current > 0) {
          sendToSsh(ESC.arrowUp);
          scrollAccumulatorRef.current -= SCROLL_THRESHOLD;
        } else {
          sendToSsh(ESC.arrowDown);
          scrollAccumulatorRef.current += SCROLL_THRESHOLD;
        }
        didScrollRef.current = true;
      }
    },
    [sendToSsh, tmuxMode, activeSessionId, touchToCell],
  );

  /** Unified touch-end: handles selection end, scroll end, tap actions */
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      // Clear long-press timer
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      // End selection drag — keep selection visible for Copy button
      if (isSelectingRef.current) {
        isSelectingRef.current = false;
        selectionStartRef.current = null;
        touchStartYRef.current = null;
        scrollAccumulatorRef.current = 0;
        return; // Don't run tap logic
      }

      touchStartYRef.current = null;
      scrollAccumulatorRef.current = 0;

      // --- Tap logic below ---

      // If we scrolled, don't treat as tap
      if (didScrollRef.current) return;

      // If there's an active text selection, clear it on tap
      if (activeSessionId) {
        const inst = instancesRef.current.get(activeSessionId);
        if (inst?.terminal.hasSelection()) {
          inst.terminal.clearSelection();
          return;
        }
      }

      // Tap exits tmux copy mode
      if (inTmuxCopyModeRef.current) {
        exitTmuxCopyMode();
        return;
      }

      // Tap-to-move-cursor
      if (!activeSessionId) return;
      const inst = instancesRef.current.get(activeSessionId);
      if (!inst) return;

      const term = inst.terminal;
      const rect = inst.containerEl.getBoundingClientRect();
      const touch = e.changedTouches[0];
      if (!touch) return;

      const cellWidth = rect.width / term.cols;
      const cellHeight = rect.height / term.rows;
      const tapCol = Math.floor((touch.clientX - rect.left) / cellWidth);
      const tapRow = Math.floor((touch.clientY - rect.top) / cellHeight);
      const curCol = term.buffer.active.cursorX;
      const curRow = term.buffer.active.cursorY;

      if (tapRow !== curRow) return;
      const diff = tapCol - curCol;
      if (diff === 0) return;

      const arrow = diff > 0 ? ESC.arrowRight : ESC.arrowLeft;
      sendToSsh(arrow.repeat(Math.abs(diff)));
    },
    [activeSessionId, sendToSsh, exitTmuxCopyMode],
  );

  const handleTerminalClick = useCallback(() => {
    imeInputRef.current?.focus();
  }, []);

  const handleCloseSession = useCallback(async () => {
    if (!activeSession) return;
    cancelReconnect(activeSession.sessionId);
    if (activeSession.status === "connected") {
      await sshDisconnect(activeSession.sessionId).catch(console.error);
    }
    useSessionStore.getState().removeSession(activeSession.sessionId);
  }, [activeSession]);

  // No sessions at all
  if (sessions.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Select a connection to start
        </p>
      </div>
    );
  }

  // Active session is in connecting state
  if (activeSession?.status === "connecting") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Connecting to SSH server...
        </p>
      </div>
    );
  }

  // Active session errored
  if (activeSession?.status === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <AlertCircle className="size-16 text-destructive/40" />
        <p className="text-sm text-destructive">
          {activeSession.error ?? "Connection failed"}
        </p>
        <Button variant="outline" onClick={handleCloseSession}>
          Close Tab
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <HiddenImeInput
        ref={imeInputRef}
        onCommit={handleImeCommit}
        onComposingUpdate={handleComposingUpdate}
        onSpecialKey={handleImeSpecialKey}
        onImeLog={isDev ? handleImeLog : undefined}
      />
      {!isMobile && <FontSizeControls />}
      <ComposingOverlay composing={composingText} />
      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 overflow-hidden [touch-action:none]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleTerminalClick}
      />
      {activeSession?.status === "disconnected" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <div className="flex flex-col items-center gap-3 rounded-soft border border-border bg-card p-6">
            <WifiOff className="size-6 text-destructive" />
            <p className="text-sm text-foreground">Connection lost</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCloseSession}>
                Close
              </Button>
              <Button size="sm" onClick={handleReconnect}>
                Reconnect
              </Button>
            </div>
          </div>
        </div>
      )}
      {activeSession?.status === "reconnecting" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80">
          <div className="flex flex-col items-center gap-3 rounded-soft border border-border bg-card p-6">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-sm text-foreground">Reconnecting...</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                cancelReconnect(activeSession.sessionId);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {showToolbar && (
        <KeyboardToolbar
          onKey={handleToolbarKey}
          isCtrlActive={isCtrlActive}
          isAltActive={isAltActive}
          isShiftActive={isShiftActive}
          onCtrlToggle={() => setIsCtrlActive((p) => !p)}
          onAltToggle={() => setIsAltActive((p) => !p)}
          onShiftToggle={() => setIsShiftActive((p) => !p)}
          onCopy={handleCopy}
          onPaste={handlePaste}
          tmuxMode={tmuxMode}
          onTmuxToggle={() => {
            setTmuxMode((p) => !p);
            if (inTmuxCopyModeRef.current) exitTmuxCopyMode();
          }}
        />
      )}
    </div>
  );
}
