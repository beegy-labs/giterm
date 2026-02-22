export const ESC = {
  enter: "\r",
  tab: "\t",
  escape: "\x1B",
  backspace: "\x7F",
  arrowUp: "\x1B[A",
  arrowDown: "\x1B[B",
  arrowLeft: "\x1B[D",
  arrowRight: "\x1B[C",
  home: "\x1B[H",
  end: "\x1B[F",
  pageUp: "\x1B[5~",
  pageDown: "\x1B[6~",
  insert: "\x1B[2~",
  delete: "\x1B[3~",
  f1: "\x1BOP",
  f2: "\x1BOQ",
  f3: "\x1BOR",
  f4: "\x1BOS",
  f5: "\x1B[15~",
  f6: "\x1B[17~",
  f7: "\x1B[18~",
  f8: "\x1B[19~",
  f9: "\x1B[20~",
  f10: "\x1B[21~",
  f11: "\x1B[23~",
  f12: "\x1B[24~",
} as const;

export function ctrl(key: string): string {
  return String.fromCharCode(key.charCodeAt(0) & 0x1f);
}
