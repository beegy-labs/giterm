import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { tauriStorage } from "@/shared/lib/tauriStorage";

const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 32;
const DEFAULT_FONT_SIZE = 14;

interface TerminalSettingsState {
  fontSize: number;
  increase: () => void;
  decrease: () => void;
  setFontSize: (size: number) => void;
}

export const useTerminalSettingsStore = create<TerminalSettingsState>()(
  persist(
    (set) => ({
      fontSize: DEFAULT_FONT_SIZE,
      increase: () =>
        set((state) => ({
          fontSize: Math.min(state.fontSize + 1, MAX_FONT_SIZE),
        })),
      decrease: () =>
        set((state) => ({
          fontSize: Math.max(state.fontSize - 1, MIN_FONT_SIZE),
        })),
      setFontSize: (size) =>
        set({
          fontSize: Math.max(MIN_FONT_SIZE, Math.min(size, MAX_FONT_SIZE)),
        }),
    }),
    {
      name: "giterm-terminal-settings",
      storage: createJSONStorage(() => tauriStorage),
    },
  ),
);
