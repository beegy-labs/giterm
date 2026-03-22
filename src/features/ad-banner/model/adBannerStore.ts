import { create } from "zustand";

const USER_ID_KEY = "giterm:user-id";
const ADS_ENABLED_KEY = "giterm:ads-enabled";
const LAST_SHOWN_KEY = "giterm:ad-last-shown";

/** 4 hours in milliseconds */
const BACKGROUND_COOLDOWN_MS = 4 * 60 * 60 * 1000;

function getOrCreateUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

function isAdsEnabled(): boolean {
  const stored = localStorage.getItem(ADS_ENABLED_KEY);
  return stored === null ? true : stored === "true";
}

function getLastShownMs(): number {
  return parseInt(localStorage.getItem(LAST_SHOWN_KEY) ?? "0", 10);
}

function setLastShownNow(): void {
  localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
}

interface AdBannerState {
  /** Stable per-install UUID — created once, never changes */
  userId: string;
  /** Whether the user has enabled ads (persisted) */
  adsEnabled: boolean;
  /** Whether a native banner is currently showing */
  isBannerVisible: boolean;

  setAdsEnabled: (enabled: boolean) => void;
  setBannerVisible: (visible: boolean) => void;

  /** Returns true if the ad should be shown based on cooldown + enabled state */
  shouldShowOnForeground: () => boolean;
  /** Returns true if this is the first launch (lastShown == 0) */
  shouldShowOnColdStart: () => boolean;
  /** Record that an ad was just shown */
  recordShown: () => void;
}

export const useAdBannerStore = create<AdBannerState>(() => ({
  userId: getOrCreateUserId(),
  adsEnabled: isAdsEnabled(),
  isBannerVisible: false,

  setAdsEnabled: (enabled) => {
    localStorage.setItem(ADS_ENABLED_KEY, String(enabled));
    useAdBannerStore.setState({ adsEnabled: enabled });
  },

  setBannerVisible: (visible) => {
    useAdBannerStore.setState({ isBannerVisible: visible });
  },

  shouldShowOnColdStart: () => {
    const state = useAdBannerStore.getState();
    if (!state.adsEnabled) return false;
    // First ever launch: lastShown == 0
    return getLastShownMs() === 0;
  },

  shouldShowOnForeground: () => {
    const state = useAdBannerStore.getState();
    if (!state.adsEnabled) return false;
    const elapsed = Date.now() - getLastShownMs();
    return elapsed >= BACKGROUND_COOLDOWN_MS;
  },

  recordShown: () => {
    setLastShownNow();
  },
}));
