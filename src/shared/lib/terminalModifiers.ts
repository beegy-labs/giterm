/**
 * Apply Ctrl/Alt/Shift modifiers to a terminal key value.
 *
 * Returns `{ output, consumed }` where `consumed` lists which modifiers
 * were used (so the caller can deactivate them).
 */
export interface ModifierState {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

export type ConsumedModifier = "ctrl" | "alt" | "shift";

interface ApplyResult {
  output: string;
  consumed: ConsumedModifier[];
}

export function applyModifiers(
  value: string,
  modifiers: ModifierState,
): ApplyResult {
  if (modifiers.ctrl && value.length === 1) {
    const code = value.toUpperCase().charCodeAt(0);
    if (code >= 65 && code <= 90) {
      return {
        output: String.fromCharCode(code - 64),
        consumed: ["ctrl"],
      };
    }
  }

  if (modifiers.alt) {
    return {
      output: "\x1B" + value,
      consumed: ["alt"],
    };
  }

  if (modifiers.shift) {
    // Shift+Arrow: insert ";2" modifier into escape sequences
    // e.g. \x1B[A → \x1B[1;2A, \x1B[3~ → \x1B[3;2~
    if (value.startsWith("\x1B[")) {
      const body = value.slice(2);
      const finalChar = body.slice(-1);
      const params = body.slice(0, -1);
      return {
        output: `\x1B[${params || "1"};2${finalChar}`,
        consumed: ["shift"],
      };
    }
    if (value.length === 1) {
      return {
        output: value.toUpperCase(),
        consumed: ["shift"],
      };
    }
  }

  return { output: value, consumed: [] };
}
