import { useEffect, useRef, useCallback, useState } from "react";
import { Loader2, AlertCircle, WifiOff } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useSessionStore, selectActiveSession } from "@/entities/session";
import {
  sshWrite,
  cancelReconnect,
  reconnectSession,
  closeSession,
} from "@/features/ssh-connect";
import { ESC } from "@/shared/lib/escapeSequences";
import { useTerminalSettingsStore } from "@/entities/session";
import { imeLogAppend, imeLogStart, imeLogStop } from "@/features/ime-log";
import { FontSizeControls } from "./FontSizeControls";
import { useIsMobile } from "@/shared/lib/useIsMobile";
import { KeyboardToolbar } from "./KeyboardToolbar";
import { HiddenImeInput, type HiddenImeInputHandle } from "./HiddenImeInput";
import { useTerminalInstances } from "../model/useTerminalInstances";
import { useSshEvents } from "../model/useSshEvents";
import { useTouchGestures } from "../model/useTouchGestures";

import "@xterm/xterm/css/xterm.css";

interface TerminalViewProps {
  showToolbar?: boolean;
}

export function TerminalView({ showToolbar = false }: TerminalViewProps) {
  const imeInputRef = useRef<HiddenImeInputHandle>(null);
  const activeSession = useSessionStore(selectActiveSession);
  const sessions = useSessionStore((s) => s.sessions);
  const isMobile = useIsMobile();
  const fontSize = useTerminalSettingsStore((s) => s.fontSize);

  const [isCtrlActive, setIsCtrlActive] = useState(false);
  const [isAltActive, setIsAltActive] = useState(false);
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [composingText, setComposingText] = useState("");
  const inTmuxCopyModeRef = useRef(false);
  const isDev = import.meta.env.DEV;

  const activeSessionId = activeSession?.sessionId;

  const { containerRef, instancesRef } = useTerminalInstances({
    sessions,
    activeSessionId,
    isMobile,
    fontSize,
    imeInputRef,
  });

  useSshEvents(instancesRef);

  const sendToSsh = useCallback((data: string) => {
    const session = selectActiveSession(useSessionStore.getState());
    if (!session || !session.sessionId) return;
    sshWrite(session.sessionId, data).catch(console.error);
  }, []);

  const exitTmuxCopyMode = useCallback(() => {
    if (inTmuxCopyModeRef.current) {
      sendToSsh("q");
      inTmuxCopyModeRef.current = false;
    }
  }, [sendToSsh]);

  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTerminalClick,
    showKeyboard,
    setShowKeyboard,
  } = useTouchGestures({
    activeSessionId,
    instancesRef,
    imeInputRef,
    isMobile,
    sendToSsh,
    exitTmuxCopyMode,
    inTmuxCopyModeRef,
  });

  const handleReconnect = useCallback(() => {
    if (!activeSession) return;
    reconnectSession(activeSession.sessionId);
  }, [activeSession]);

  const handleTmuxScroll = useCallback(
    (direction: -1 | 1) => {
      const inst = activeSessionId
        ? instancesRef.current.get(activeSessionId)
        : null;
      if (!inst) return;
      const isAltScreen =
        inst.terminal.buffer.active === inst.terminal.buffer.alternate;
      if (isAltScreen) {
        if (!inTmuxCopyModeRef.current) {
          sendToSsh("\x02[");
          inTmuxCopyModeRef.current = true;
        }
        sendToSsh(direction === -1 ? ESC.arrowUp : ESC.arrowDown);
      } else {
        inst.terminal.scrollLines(direction);
      }
    },
    [activeSessionId, instancesRef, sendToSsh],
  );

  const handleImeCommit = useCallback(
    (text: string) => {
      exitTmuxCopyMode();
      sendToSsh(text);
    },
    [sendToSsh, exitTmuxCopyMode],
  );

  // Dev only: auto-start IME file logging on mount, stop on unmount
  useEffect(() => {
    if (!isDev) return;
    imeLogStart().catch(console.error);
    return () => {
      imeLogStop().catch(console.error);
    };
  }, [isDev]);

  const handleToolbarKey = useCallback(
    (value: string) => {
      if (!value) return;
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
    try {
      await navigator.clipboard.writeText(sel);
      inst?.terminal.clearSelection();
    } catch {
      // Clipboard API not available (e.g. iOS WKWebView restrictions)
    }
  }, [activeSessionId, instancesRef]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      sendToSsh("\x1b[200~" + text.replace(/\n/g, "\r") + "\x1b[201~");
    } catch {
      // Clipboard API not available
    }
  }, [sendToSsh]);

  const handleCloseSession = useCallback(async () => {
    if (!activeSession) return;
    await closeSession(activeSession.sessionId);
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
    <div className="relative flex min-h-0 flex-1 flex-col">
      <HiddenImeInput
        ref={imeInputRef}
        onCommit={handleImeCommit}
        onComposingUpdate={setComposingText}
        onSpecialKey={sendToSsh}
        onImeLog={isDev ? (line: string) => imeLogAppend(line).catch(console.error) : undefined}
        inputMode={showKeyboard ? "text" : "none"}
      />
      {!isMobile && <FontSizeControls />}
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
          onScrollUp={() => handleTmuxScroll(-1)}
          onScrollDown={() => handleTmuxScroll(1)}
          showKeyboard={showKeyboard}
          composingText={composingText}
          onKeyboardToggle={() => {
            setShowKeyboard((p) => {
              const next = !p;
              if (next) {
                imeInputRef.current?.focusWithKeyboard();
              }
              return next;
            });
          }}
        />
      )}
    </div>
  );
}
