import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react";
import type { HiddenImeInputHandle } from "../ui/HiddenImeInput";
import type { TermInstance } from "./types";
import { ESC } from "@/shared/lib/escapeSequences";

const SCROLL_THRESHOLD = 20; // pixels per scroll line
const LONG_PRESS_MS = 400;
const LONG_PRESS_MOVE_TOLERANCE = 8; // px

export function useTouchGestures(args: {
  activeSessionId: string | undefined;
  instancesRef: MutableRefObject<Map<string, TermInstance>>;
  imeInputRef: RefObject<HiddenImeInputHandle | null>;
  isMobile: boolean;
  sendToSsh: (data: string) => void;
  exitTmuxCopyMode: () => void;
  inTmuxCopyModeRef: MutableRefObject<boolean>;
}): {
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: (e: React.TouchEvent) => void;
  handleTerminalClick: () => void;
  showKeyboard: boolean;
  setShowKeyboard: Dispatch<SetStateAction<boolean>>;
} {
  const {
    activeSessionId,
    instancesRef,
    imeInputRef,
    isMobile,
    sendToSsh,
    exitTmuxCopyMode,
    inTmuxCopyModeRef,
  } = args;

  const [showKeyboard, setShowKeyboard] = useState(false);

  // Scroll gesture refs
  const touchStartYRef = useRef<number | null>(null);
  const scrollAccumulatorRef = useRef(0);
  const didScrollRef = useRef(false);

  // Long-press text selection refs
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef<{
    col: number;
    row: number;
    bufferRow: number;
  } | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressRectRef = useRef<DOMRect | null>(null);

  const touchToCell = useCallback(
    (clientX: number, clientY: number, preRect?: DOMRect | null) => {
      if (!activeSessionId) return null;
      const inst = instancesRef.current.get(activeSessionId);
      if (!inst) return null;
      const term = inst.terminal;
      const rect = preRect ?? inst.containerEl.getBoundingClientRect();
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
    [activeSessionId, instancesRef],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (e.touches.length === 1 && touch) {
        touchStartYRef.current = touch.clientY;
        scrollAccumulatorRef.current = 0;
        didScrollRef.current = false;
        touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

        const inst = activeSessionId
          ? instancesRef.current.get(activeSessionId)
          : null;
        longPressRectRef.current =
          inst?.containerEl.getBoundingClientRect() ?? null;

        const cx = touch.clientX;
        const cy = touch.clientY;
        longPressTimerRef.current = setTimeout(() => {
          longPressTimerRef.current = null;
          const cell = touchToCell(cx, cy, longPressRectRef.current);
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
    [touchToCell, activeSessionId, instancesRef],
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

      const inst = activeSessionId
        ? instancesRef.current.get(activeSessionId)
        : null;
      const isAltScreen =
        inst != null &&
        inst.terminal.buffer.active === inst.terminal.buffer.alternate;

      while (Math.abs(scrollAccumulatorRef.current) >= SCROLL_THRESHOLD) {
        if (isAltScreen) {
          if (!inTmuxCopyModeRef.current) {
            sendToSsh("\x02["); // Ctrl+B [ = enter tmux copy mode
            inTmuxCopyModeRef.current = true;
          }
          sendToSsh(scrollAccumulatorRef.current > 0 ? ESC.arrowUp : ESC.arrowDown);
        } else {
          if (scrollAccumulatorRef.current > 0) {
            inst?.terminal.scrollLines(-1);
          } else {
            inst?.terminal.scrollLines(1);
          }
        }
        if (scrollAccumulatorRef.current > 0) {
          scrollAccumulatorRef.current -= SCROLL_THRESHOLD;
        } else {
          scrollAccumulatorRef.current += SCROLL_THRESHOLD;
        }
        didScrollRef.current = true;
      }
    },
    [activeSessionId, instancesRef, touchToCell, sendToSsh],
  );

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
        return;
      }

      touchStartYRef.current = null;
      scrollAccumulatorRef.current = 0;

      // If we scrolled, don't treat as tap
      if (didScrollRef.current) return;

      // Tap = user wants to type → show keyboard immediately.
      setShowKeyboard(true);
      imeInputRef.current?.focusWithKeyboard();

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
    [activeSessionId, instancesRef, imeInputRef, sendToSsh, exitTmuxCopyMode],
  );

  const handleTerminalClick = useCallback(() => {
    if (isMobile) {
      setShowKeyboard(true);
      imeInputRef.current?.focusWithKeyboard();
    } else {
      imeInputRef.current?.focus();
    }
  }, [isMobile, imeInputRef]);

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTerminalClick,
    showKeyboard,
    setShowKeyboard,
  };
}
