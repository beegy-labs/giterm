import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { tauriStorage } from "@/shared/adapters/tauriStorage";

const MIN_FONT_SIZE = 8;
const MAX_FONT_SIZE = 32;
const DEFAULT_FONT_SIZE = 14;

const clamp = (size: number) =>
  Math.max(MIN_FONT_SIZE, Math.min(size, MAX_FONT_SIZE));

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
      increase: () => set((state) => ({ fontSize: clamp(state.fontSize + 1) })),
      decrease: () => set((state) => ({ fontSize: clamp(state.fontSize - 1) })),
      setFontSize: (size) => set({ fontSize: clamp(size) }),
    }),
    {
      name: "giterm-terminal-settings",
      storage: createJSONStorage(() => tauriStorage),
    },
  ),
);
