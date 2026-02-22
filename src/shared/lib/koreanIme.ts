// Korean Unicode ranges
const SYLLABLE_START = 0xac00;
const SYLLABLE_END = 0xd7a3;
const JAMO_START = 0x1100;
const JAMO_END = 0x11ff;
const COMPAT_JAMO_START = 0x3130;
const COMPAT_JAMO_END = 0x318f;

/** Check if a character is a composed Korean syllable (가-힣) */
export function isSyllable(char: string): boolean {
  if (!char) return false;
  const code = char.codePointAt(0);
  if (code === undefined) return false;
  return code >= SYLLABLE_START && code <= SYLLABLE_END;
}

/** Check if a character is Korean (syllable or jamo) */
export function isKorean(char: string): boolean {
  if (!char) return false;
  const code = char.codePointAt(0);
  if (code === undefined) return false;
  return (
    (code >= SYLLABLE_START && code <= SYLLABLE_END) ||
    (code >= JAMO_START && code <= JAMO_END) ||
    (code >= COMPAT_JAMO_START && code <= COMPAT_JAMO_END)
  );
}

/**
 * Calculate safe commit count.
 * Only the LAST Korean character may still change during composition.
 * - Korean ending: charCount - 1 (last char still composing)
 * - Non-Korean ending: charCount (all chars confirmed)
 */
export function calculateSafeCommitCount(
  charCount: number,
  isLastKorean: boolean,
): number {
  if (charCount <= 0) return 0;
  return isLastKorean ? charCount - 1 : charCount;
}

/** Check if this is a duplicate event (iOS bug) */
export function isDuplicateEvent(
  currentText: string,
  lastText: string,
): boolean {
  return currentText === lastText;
}

/** Check if a Korean syllable has no final consonant (종성) */
export function hasNoFinalConsonant(char: string): boolean {
  const code = char.codePointAt(0);
  if (code === undefined) return false;
  if (code < SYLLABLE_START || code > SYLLABLE_END) return false;
  return (code - SYLLABLE_START) % 28 === 0;
}

/** Check if a character is a bare Korean consonant (compatibility jamo ㄱ-ㅎ) */
export function isBareConsonant(char: string): boolean {
  const code = char.codePointAt(0);
  if (code === undefined) return false;
  return code >= 0x3131 && code <= 0x314e;
}

/** Split string into characters (Array.from handles surrogate pairs) */
export function toChars(str: string): string[] {
  return Array.from(str);
}

// Jongseong index → compatibility jamo mapping
const JONGSEONG_TO_COMPAT = [
  "", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ",
  "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ",
  "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

/**
 * Extract the jongseong (종성) that was merged during IME recomposition.
 * e.g., original "가" + recomposed "강" → returns "ㅇ"
 *       original "리" + recomposed "링" → returns "ㅇ"
 * Returns null if no simple jongseong merge detected.
 */
export function extractMergedJongseong(
  original: string,
  recomposed: string,
): string | null {
  const origCode = original.codePointAt(0);
  const recompCode = recomposed.codePointAt(0);
  if (origCode === undefined || recompCode === undefined) return null;
  if (origCode < SYLLABLE_START || origCode > SYLLABLE_END) return null;
  if (recompCode < SYLLABLE_START || recompCode > SYLLABLE_END) return null;

  const origJong = (origCode - SYLLABLE_START) % 28;
  const recompJong = (recompCode - SYLLABLE_START) % 28;
  const origBase = origCode - origJong;
  const recompBase = recompCode - recompJong;

  // Same base syllable (초성+중성), only jongseong differs
  if (origBase === recompBase && origJong === 0 && recompJong > 0) {
    return JONGSEONG_TO_COMPAT[recompJong] ?? null;
  }
  return null;
}
