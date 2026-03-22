import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";
const STORAGE_KEY = "giterm-theme";

function readStored(): Theme {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem(STORAGE_KEY) as Theme) ?? "dark";
}

function applyTheme(theme: Theme) {
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  localStorage.setItem(STORAGE_KEY, theme);
}

let _theme: Theme = readStored();
let _listeners: Array<() => void> = [];

// Apply immediately on module load (before React mounts)
if (typeof window !== "undefined") applyTheme(_theme);

function subscribe(cb: () => void) {
  _listeners.push(cb);
  return () => {
    _listeners = _listeners.filter((l) => l !== cb);
  };
}

function getSnapshot(): Theme {
  return _theme;
}

export function setTheme(theme: Theme) {
  _theme = theme;
  applyTheme(theme);
  _listeners.forEach((l) => l());
}

export function toggleTheme() {
  setTheme(_theme === "dark" ? "light" : "dark");
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getSnapshot, () => "dark");
}
