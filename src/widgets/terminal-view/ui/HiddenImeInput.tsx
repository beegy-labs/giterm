import {
  useRef,
  useCallback,
  useImperativeHandle,
  useEffect,
  forwardRef,
} from "react";
import { ESC } from "@/shared/lib/escapeSequences";
import {
  processText as processImeText,
  createInitialState,
  type ImeAction,
} from "@/shared/lib/koreanImeProcessor";

// IME debug logging — only active in development mode.
const IME_DEBUG = import.meta.env.DEV;

// ============================================================================
// Single-field Korean IME input — beforeinput-based event handling.
// ============================================================================
//
// iOS Korean IME does NOT fire compositionstart/compositionend/compositionupdate.
// Instead, it uses a DELETE+INSERT pair for every keystroke during composition:
//   1. beforeinput(deleteContentBackward) — removes previous partial char
//   2. beforeinput(insertText) — inserts new combined char
//
// SINGLE INPUT (not dual):
// Previous dual-input approach used blur()+focus() to swap between two fields,
// which caused iOS WKWebView to NOT immediately transfer first responder — the
// old input kept receiving events for up to 17 seconds (confirmed in logs).
//
// Fix: single hidden input, reset composition by setting input.value = "".
// No focus movement → no focus loss, no "ignored" events.
//
// IME RESET ("swap"):
// When composition ends (composing=""), set input.value="" to clear the
// browser's composition buffer. iOS will start fresh on the next keystroke.
// This happens deferred (in beforeinput(insertText)) to avoid ghost chars:
// ghost chars occur when iOS merges an in-flight insert with a stale buffer.
// ============================================================================

export interface HiddenImeInputHandle {
  focus: () => void;
  handleToolbarBackspace: () => void;
}

interface HiddenImeInputProps {
  onCommit: (text: string) => void;
  onComposingUpdate: (composing: string) => void;
  onSpecialKey: (key: string) => void;
  onImeLog?: (line: string) => void;
}

const INPUT_STYLE =
  "pointer-events-auto absolute -left-[10000px] -top-[10000px] size-px opacity-0";

export const HiddenImeInput = forwardRef<
  HiddenImeInputHandle,
  HiddenImeInputProps
>(function HiddenImeInput(
  { onCommit, onComposingUpdate, onSpecialKey, onImeLog },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);

  const imeStateRef = useRef(createInitialState());
  // iOS delete+insert pair detection: set on deleteContentBackward,
  // cleared on the subsequent insertText. Tells onChange to skip the
  // intermediate empty value from the delete half.
  const expectingInsertRef = useRef(false);
  // Fallback timer: if no insertText follows deleteContentBackward within
  // 50ms, treat it as a real backspace (not an IME recomposition).
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Deferred reset flag: set when composition ends.
  // Actual input.value="" executes in next beforeinput(insertText) to prevent
  // ghost chars (iOS would merge the incoming char with the stale buffer).
  const needsResetRef = useRef(false);

  const resetImeState = useCallback(() => {
    const state = imeStateRef.current;
    state.outputted = "";
    state.composing = "";
    state.lastText = "";
  }, []);

  const logIme = useCallback(
    (msg: string) => {
      if (!IME_DEBUG) return;
      onImeLog?.(msg);
    },
    [onImeLog],
  );

  /**
   * Reset the IME composition buffer without moving focus.
   * Sets input.value="" so iOS starts fresh on the next keystroke.
   * Typically called within beforeinput(insertText) so the reset happens
   * BEFORE iOS routes the new character, preventing ghost chars.
   */
  const resetField = useCallback(() => {
    needsResetRef.current = false;
    expectingInsertRef.current = false;
    resetImeState();

    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }

    const input = inputRef.current;
    if (input) input.value = "";

    logIme("[IME] RESET: cleared composition buffer");
  }, [resetImeState, logIme]);

  /** Execute IME actions. `sync` = true when called within user gesture. */
  const executeActions = useCallback(
    (actions: ImeAction[], sync: boolean) => {
      for (const action of actions) {
        switch (action.type) {
          case "commit":
            onCommit(action.char);
            break;
          case "composing":
            onComposingUpdate(action.text);
            break;
          case "backspace":
            onSpecialKey(ESC.backspace);
            break;
          case "swap": {
            // Defer reset to next beforeinput(insertText).
            //
            // If we reset immediately (sync), iOS may still have the old
            // composition buffer in-flight for the current event. Waiting for
            // the next insertText event ensures we reset BEFORE iOS routes the
            // new character — so it lands on a clean buffer, not a stale one.
            needsResetRef.current = true;
            expectingInsertRef.current = false;
            if (deleteTimerRef.current) {
              clearTimeout(deleteTimerRef.current);
              deleteTimerRef.current = null;
            }
            resetImeState();
            // Clear DOM value immediately so handleChange ignores any stale events
            const inp = inputRef.current;
            if (inp) inp.value = "";
            logIme("[IME] RESET_DEFERRED: awaiting next insertText (sync=" + sync + ")");
            break;
          }
        }
      }
    },
    [onCommit, onComposingUpdate, onSpecialKey, resetImeState, logIme],
  );

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    };
  }, []);

  // ---- beforeinput handler ----
  const handleBeforeInput = useCallback(
    (e: InputEvent) => {
      logIme(
        "[IME] BEFOREINPUT: type=" + e.inputType +
          " reset=" + needsResetRef.current +
          " comp=" + imeStateRef.current.composing +
          " out=" + imeStateRef.current.outputted,
      );

      if (e.inputType === "deleteContentBackward") {
        // === Priority 1: Consume deferred reset ===
        // This delete is iOS IME's internal cleanup after composition — no backspace needed.
        if (needsResetRef.current) {
          logIme("[IME] BEFOREINPUT: consuming deferred reset on delete");
          resetField();
          if (e.cancelable) e.preventDefault();
          return;
        }

        // === Priority 2: Bare backspace on empty input ===
        const input = inputRef.current;
        if (
          imeStateRef.current.composing === "" &&
          input &&
          input.value === ""
        ) {
          if (e.cancelable) e.preventDefault();
          onSpecialKey(ESC.backspace);
          logIme("[IME] BEFOREINPUT: bare backspace");
          return;
        }

        // === Priority 3: iOS delete+insert pair detection ===
        // Mark that we expect an insertText to follow (IME recomposition).
        // Start a 50ms fallback timer — if no insert arrives, treat as real backspace.
        expectingInsertRef.current = true;
        if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
        deleteTimerRef.current = setTimeout(() => {
          deleteTimerRef.current = null;
          expectingInsertRef.current = false;
          // Real backspace — process current input value (deferred context)
          const text = inputRef.current?.value ?? "";
          logIme("[IME] DELETE_TIMER: processing text=" + text);
          const actions = processImeText(imeStateRef.current, text);
          // Execute non-swap actions immediately; defer reset to next user gesture
          const nonSwapActions = actions.filter((a) => a.type !== "swap");
          const hasSwapAction = actions.some((a) => a.type === "swap");
          logIme(
            "[IME] DELETE_TIMER: actions=" +
              actions.map((a) => a.type).join(",") +
              " out=" + imeStateRef.current.outputted +
              " comp=" + imeStateRef.current.composing,
          );
          executeActions(nonSwapActions, false);
          if (hasSwapAction) {
            needsResetRef.current = true;
            logIme("[IME] DELETE_TIMER: reset deferred to next gesture");
          }
        }, 50);
        logIme("[IME] BEFOREINPUT: expecting insert (delete+insert pair)");
        return;
      }

      // === insertText / insertCompositionText ===
      if (
        e.inputType === "insertText" ||
        e.inputType === "insertCompositionText"
      ) {
        // Execute deferred reset BEFORE iOS inserts text.
        // Clearing value here (before the insert) means iOS delivers the new
        // character to an empty buffer — no ghost chars from stale composition.
        if (needsResetRef.current) {
          logIme("[IME] BEFOREINPUT: executing deferred reset (insertText)");
          resetField();
          // Do NOT return — let the insert proceed normally into the clean input.
          // handleChange will fire next with just the new character.
        }

        if (expectingInsertRef.current) {
          // This is the insert half of the iOS delete+insert cycle.
          // Cancel the fallback timer — onChange will process the combined value.
          expectingInsertRef.current = false;
          if (deleteTimerRef.current) {
            clearTimeout(deleteTimerRef.current);
            deleteTimerRef.current = null;
          }
          logIme("[IME] BEFOREINPUT: insert received (pair complete)");
        }
      }
    },
    [logIme, resetField, onSpecialKey, executeActions],
  );

  // Register beforeinput listener on mount.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.addEventListener("beforeinput", handleBeforeInput);
    return () => {
      input.removeEventListener("beforeinput", handleBeforeInput);
    };
  }, [handleBeforeInput]);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    handleToolbarBackspace: () => {
      const state = imeStateRef.current;
      if (state.composing !== "") {
        state.composing = "";
        onComposingUpdate("");
        onSpecialKey(ESC.backspace);
        resetField();
        return;
      }
      onSpecialKey(ESC.backspace);
    },
  }));

  /**
   * onChange handler — processes input synchronously (no setTimeout!).
   *
   * When expectingInsertRef is true, this onChange came from the delete half
   * of an iOS delete+insert pair. Skip it — the next onChange (from the
   * insert half) will have the correct combined value.
   */
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const text = e.target.value;
      const state = imeStateRef.current;

      // Fallback deferred reset — safety net if beforeinput(insertText) was missed.
      if (needsResetRef.current) {
        logIme("[IME] CHANGE: executing deferred reset (fallback, beforeinput missed)");
        resetField();
        // Continue processing below with reset state
      }

      // Skip the delete half of iOS delete+insert pair.
      if (expectingInsertRef.current) {
        if (text === "" || (state.lastText !== "" && state.lastText.startsWith(text))) {
          logIme("[IME] CHANGE: skipped (expecting insert) text=" + text);
          return;
        }
        expectingInsertRef.current = false;
        if (deleteTimerRef.current) {
          clearTimeout(deleteTimerRef.current);
          deleteTimerRef.current = null;
        }
        logIme("[IME] CHANGE: recovered insert (missed beforeinput)");
      }

      logIme(
        "[IME] CHANGE: text=" + text + " out=" + state.outputted +
          " comp=" + state.composing,
      );

      const actions = processImeText(state, text);
      logIme(
        "[IME] ACTIONS: " +
          actions.map((a) => a.type).join(",") +
          " out=" + state.outputted + " comp=" + state.composing,
      );
      executeActions(actions, true);
    },
    [executeActions, logIme, resetField],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const key = e.key;
      const input = inputRef.current;
      const state = imeStateRef.current;

      // Handle backspace on empty input BEFORE isComposing check
      if (
        key === "Backspace" &&
        state.composing === "" &&
        input &&
        input.value === ""
      ) {
        e.preventDefault();
        onSpecialKey(ESC.backspace);
        logIme("[IME] KEYDOWN: bare backspace (empty input)");
        return;
      }

      if (e.nativeEvent.isComposing) return;

      if (e.ctrlKey && key.length === 1) {
        e.preventDefault();
        const code = key.toUpperCase().charCodeAt(0);
        if (code >= 65 && code <= 90) {
          onSpecialKey(String.fromCharCode(code - 64));
        }
        return;
      }

      if (key === "Enter") {
        e.preventDefault();
        // Cancel any pending delete timer
        if (deleteTimerRef.current) {
          clearTimeout(deleteTimerRef.current);
          deleteTimerRef.current = null;
          expectingInsertRef.current = false;
        }
        if (state.composing !== "") {
          onCommit(state.composing);
          state.composing = "";
          onComposingUpdate("");
        }
        onSpecialKey(ESC.enter);
        resetField(); // Reset on Enter
        return;
      }

      if (key === "Backspace") {
        if (input && input.value !== "") {
          return; // Let onChange handle it
        }
        if (state.composing === "") {
          e.preventDefault();
          onSpecialKey(ESC.backspace);
        }
        return;
      }

      if (key === "ArrowUp") {
        e.preventDefault();
        onSpecialKey(ESC.arrowUp);
        return;
      }
      if (key === "ArrowDown") {
        e.preventDefault();
        onSpecialKey(ESC.arrowDown);
        return;
      }
      if (key === "ArrowLeft") {
        if (input && input.value === "") {
          e.preventDefault();
          onSpecialKey(ESC.arrowLeft);
        }
        return;
      }
      if (key === "ArrowRight") {
        if (input && input.value === "") {
          e.preventDefault();
          onSpecialKey(ESC.arrowRight);
        }
        return;
      }
      if (key === "Tab") {
        e.preventDefault();
        onSpecialKey(ESC.tab);
        return;
      }
      if (key === "Escape") {
        e.preventDefault();
        onSpecialKey(ESC.escape);
        return;
      }
    },
    [onCommit, onComposingUpdate, onSpecialKey, resetField, logIme],
  );

  return (
    <input
      ref={inputRef}
      type="text"
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className={INPUT_STYLE}
      autoCapitalize="off"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      enterKeyHint="send"
      aria-hidden={true}
      tabIndex={-1}
    />
  );
});
