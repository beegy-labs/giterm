import type { Theme } from "@/shared/lib/useTheme";

/** Signal Dark terminal theme — green-black with emerald accents */
export const terminalDarkTheme = {
  background: "#0B0E0C",
  foreground: "#DCE8DF",
  cursor: "#10B981",
  cursorAccent: "#0B0E0C",
  selectionBackground: "#1C2B22",
  selectionForeground: "#DCE8DF",
  black: "#111512",
  red: "#FB7185",
  green: "#10B981",
  yellow: "#FBBF24",
  blue: "#60A5FA",
  magenta: "#C084FC",
  cyan: "#34D399",
  white: "#DCE8DF",
  brightBlack: "#88A896",
  brightRed: "#FCA5A5",
  brightGreen: "#6EE7B7",
  brightYellow: "#FDE68A",
  brightBlue: "#93C5FD",
  brightMagenta: "#D8B4FE",
  brightCyan: "#A7F3D0",
  brightWhite: "#F0FAF4",
} as const;

/** Signal Light terminal theme — pearl white with deep emerald */
export const terminalLightTheme = {
  background: "#F4F6F5",
  foreground: "#0A1A0F",
  cursor: "#065F46",
  cursorAccent: "#F4F6F5",
  selectionBackground: "#C4D4CA",
  selectionForeground: "#0A1A0F",
  black: "#0A1A0F",
  red: "#991B1B",
  green: "#065F46",
  yellow: "#92400E",
  blue: "#1E3A5F",
  magenta: "#6B21A8",
  cyan: "#155E75",
  white: "#3D5448",
  brightBlack: "#3D5448",
  brightRed: "#DC2626",
  brightGreen: "#059669",
  brightYellow: "#D97706",
  brightBlue: "#2563EB",
  brightMagenta: "#9333EA",
  brightCyan: "#0891B2",
  brightWhite: "#111827",
} as const;

/** @deprecated use terminalDarkTheme */
export const terminalTheme = terminalDarkTheme;

export function getTerminalTheme(uiTheme: Theme) {
  return uiTheme === "light" ? terminalLightTheme : terminalDarkTheme;
}
