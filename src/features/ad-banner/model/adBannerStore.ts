import { create } from "zustand";

interface AdBannerState {
  /** Whether an ad is loaded and ready to display */
  isAdLoaded: boolean;
  setAdLoaded: (loaded: boolean) => void;
}

export const useAdBannerStore = create<AdBannerState>((set) => ({
  isAdLoaded: false,
  setAdLoaded: (loaded) => set({ isAdLoaded: loaded }),
}));
