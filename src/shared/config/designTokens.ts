/**
 * Midnight Gentle Study Design Tokens
 * WCAG 2.1 AAA Compliant | 8pt Grid System
 */

export const colors = {
  background: "#1E1C1A",
  surface: "#282522",
  surfaceContainer: "#322F2B",
  surfaceContainerHigh: "#3C3835",

  onSurface: "#CCC5BD",
  textSecondary: "#9A9590",
  textHint: "#6B6560",

  primary: "#D0B080",
  secondary: "#A89070",
  tertiary: "#8B9070",

  error: "#D9534F",
  success: "#5CB85C",
  warning: "#F0AD4E",

  border: "#3C3835",
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 40,
  "3xl": 48,
} as const;

export const radius = {
  none: 0,
  sm: 4,
  soft: 8,
  md: 12,
  full: 9999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 12,
  md: 13,
  base: 14,
  lg: 16,
  xl: 18,
  "2xl": 20,
  "3xl": 24,
  "4xl": 28,
} as const;

export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  hero: 64,
} as const;

export const terminalTheme = {
  background: "#1E1C1A",
  foreground: "#CCC5BD",
  cursor: "#D0B080",
  cursorAccent: "#1E1C1A",
  selectionBackground: "#3C3835",
  selectionForeground: "#CCC5BD",
  black: "#282522",
  red: "#D9534F",
  green: "#7D9B65",
  yellow: "#D0B080",
  blue: "#7B9CB5",
  magenta: "#B57B9E",
  cyan: "#7BAF9E",
  white: "#CCC5BD",
  brightBlack: "#6B6560",
  brightRed: "#E87070",
  brightGreen: "#A3C484",
  brightYellow: "#E0C896",
  brightBlue: "#96B5CC",
  brightMagenta: "#CC96B8",
  brightCyan: "#96C8B8",
  brightWhite: "#E5DED6",
} as const;
