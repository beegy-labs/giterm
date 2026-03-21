/**
 * Korean IME text processor — pure logic, no DOM/React dependency.
 *
 * Tracks the state of Korean IME input:
 * - `outputted`: text that has been safely committed to the terminal
 * - `composing`: the character currently being composed by Korean IME
 * - `lastText`: the last input value we processed (for change detection)
 *
 * The processor transforms a sequence of input values (as received from
 * onChange events) into a stream of actions: commit chars, update composing,
 * send special keys (backspace), and trigger input swaps.
 */
import {
  isKorean,
  calculateSafeCommitCount,
  isDuplicateEvent,
  toChars,
  extractMergedJongseong,
} from "./koreanIme";

export type ImeAction =
  | { type: "commit"; char: string }
  | { type: "composing"; text: string }
  | { type: "backspace" }
  | { type: "swap" };

export interface ImeState {
  outputted: string;
  composing: string;
  lastText: string;
}

export function createInitialState(): ImeState {
  return { outputted: "", composing: "", lastText: "" };
}

/**
 * Process a new input value and return the actions to take.
 * Also mutates `state` in place for the next call.
 */
export function processText(state: ImeState, text: string): ImeAction[] {
  const actions: ImeAction[] = [];
  const lastText = state.lastText;

  // ===== Empty string handling =====
  if (text === "") {
    // Real clear. The delete-half of iOS delete+insert is already filtered
    // in the input layer, so we can safely treat empty here as actual clear.
    if (state.composing !== "") {
      actions.push({ type: "backspace" });
    }
    state.composing = "";
    actions.push({ type: "composing", text: "" });
    // Swap to reset iOS IME buffer after full deletion
    if (lastText !== "") {
      actions.push({ type: "swap" });
    }
    state.lastText = text;
    return actions;
  }

  // ===== Duplicate event filtering =====
  if (isDuplicateEvent(text, lastText)) {
    state.lastText = text;
    return actions;
  }

  const chars = toChars(text);
  const charCount = chars.length;
  const lastChars = toChars(lastText);
  const lastCharCount = lastChars.length;
  const lastChar = chars[charCount - 1]!;
  const lastCharIsKorean = isKorean(lastChar);
  const outputtedChars = toChars(state.outputted);
  const outputtedCount = outputtedChars.length;

  // ===== DELETION DETECTION =====
  if (charCount < lastCharCount) {
    // Check if this is real deletion (prefix preserved)
    const isReal = isRealDeletion(chars, lastChars, state.composing);

    if (!isReal) {
      // Check for RECOMP: iOS merged jamo across syllable boundary
      // e.g., "반가우" → "반강" (ㅇ from 우 merges into 가 → 강)
      let prefixMatch = 0;
      for (let i = 0; i < Math.min(charCount, outputtedCount); i++) {
        if (chars[i] === outputtedChars[i]) {
          prefixMatch++;
        } else {
          break;
        }
      }

      if (prefixMatch > 0 && prefixMatch < charCount) {
        // RECOMP detected: extract the merged jongseong
        const recomposedChar = chars[prefixMatch]!;
        const originalChar = outputtedChars[prefixMatch];
        const mergedJamo =
          originalChar != null
            ? extractMergedJongseong(originalChar, recomposedChar)
            : null;

        state.composing = mergedJamo ?? "";
        actions.push({ type: "composing", text: state.composing });
        state.lastText = state.outputted + (mergedJamo ?? "");
        return actions;
      }

      // Pure IME intermediate event — update composing
      state.composing = lastCharIsKorean ? lastChar : "";
      actions.push({ type: "composing", text: state.composing });
      state.lastText = text;
      return actions;
    }

    // Real deletion
    const remainingOutputted =
      outputtedCount < charCount ? outputtedCount : charCount;
    const outputtedDeleted = outputtedCount - remainingOutputted;

    for (let i = 0; i < outputtedDeleted; i++) {
      actions.push({ type: "backspace" });
    }

    if (remainingOutputted === 0) {
      state.outputted = "";
    } else {
      state.outputted = chars.slice(0, remainingOutputted).join("");
    }

    if (
      charCount > 0 &&
      lastCharIsKorean &&
      remainingOutputted < charCount
    ) {
      state.composing = lastChar;
    } else {
      state.composing = "";
    }
    actions.push({ type: "composing", text: state.composing });
    state.lastText = text;

    // Swap when composing becomes empty — iOS IME buffer needs reset.
    // HiddenImeInput defers the actual focus() to next user gesture (safe timing).
    if (state.composing === "") {
      actions.push({ type: "swap" });
    }
    return actions;
  }

  // ===== Single non-Korean char — commit immediately and swap =====
  if (charCount === 1 && !lastCharIsKorean) {
    state.outputted += lastChar;
    actions.push({ type: "commit", char: lastChar });
    state.composing = "";
    actions.push({ type: "composing", text: "" });
    state.lastText = text;
    actions.push({ type: "swap" });
    return actions;
  }

  // ===== Non-Korean at end terminates composition =====
  if (!lastCharIsKorean) {
    // Commit all uncommitted chars
    for (let i = outputtedCount; i < charCount; i++) {
      state.outputted += chars[i]!;
      actions.push({ type: "commit", char: chars[i]! });
    }
    state.composing = "";
    actions.push({ type: "composing", text: "" });
    state.lastText = text;
    actions.push({ type: "swap" });
    return actions;
  }

  // ===== Core: Safe commit calculation (Korean only) =====
  const safeCompletedCount = calculateSafeCommitCount(
    charCount,
    lastCharIsKorean,
  );

  // Output completed characters (only new ones)
  if (safeCompletedCount > outputtedCount) {
    let prefixMatches = true;
    for (let i = 0; i < outputtedCount && i < safeCompletedCount; i++) {
      if (chars[i] !== outputtedChars[i]) {
        prefixMatches = false;
        break;
      }
    }
    if (prefixMatches) {
      for (let i = outputtedCount; i < safeCompletedCount; i++) {
        state.outputted += chars[i]!;
        actions.push({ type: "commit", char: chars[i]! });
      }
    }
  }

  // Update composing (always Korean here)
  const newComposing = lastChar;
  if (state.composing !== newComposing) {
    state.composing = newComposing;
    actions.push({ type: "composing", text: newComposing });
  }

  state.lastText = text;
  return actions;
}

/** Check if chars is a prefix of lastChars (real deletion removes from end) */
function isRealDeletion(
  chars: string[],
  lastChars: string[],
  composing: string,
): boolean {
  if (chars.length === 0) return true;
  const deletedCount = lastChars.length - chars.length;
  for (let i = 0; i < chars.length; i++) {
    if (i >= lastChars.length || chars[i] !== lastChars[i]) {
      return false;
    }
  }
  if (deletedCount > 1 && composing !== "") {
    return false;
  }
  return true;
}
