import { useEffect } from "react";
import { useAdBannerStore } from "./adBannerStore";
import { admobInit, admobBannerShow, admobBannerHide } from "../adapters/api/adBannerApi";

/**
 * AdMob banner unit IDs.
 * Replace with production IDs from the AdMob console.
 * Test IDs are safe to commit — they never serve real ads.
 */
const AD_UNIT_ID = "ca-app-pub-3940256099942544/2934735716"; // test banner

/**
 * Read --sat CSS variable (safe-area-top in px).
 * Returns 0 if not set (desktop / before Rust injects it).
 */
function getSafeAreaTop(): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--sat")
    .trim();
  return parseFloat(raw) || 0;
}

async function showBanner(userId: string, recordShown: () => void) {
  try {
    const safeAreaTop = getSafeAreaTop();
    await admobBannerShow({ adUnitId: AD_UNIT_ID, userId, safeAreaTop });
    recordShown();
    useAdBannerStore.getState().setBannerVisible(true);
    // Inject CSS var so React layout shifts down by 50px
    document.documentElement.style.setProperty("--ad-banner-h", "50px");
  } catch (err) {
    console.warn("[AdMob] show failed:", err);
  }
}

async function hideBanner() {
  try {
    await admobBannerHide();
    useAdBannerStore.getState().setBannerVisible(false);
    document.documentElement.style.setProperty("--ad-banner-h", "0px");
  } catch (err) {
    console.warn("[AdMob] hide failed:", err);
  }
}

/**
 * useAdBanner — handles SDK init, cold-start ad, and background-return ad.
 *
 * Display rules:
 *  - Cold start (first ever launch): always show (if ads enabled)
 *  - Background → foreground: show only if ≥ 4 hours since last display
 *  - Ad not available (SDK error): invisible, no space reserved
 *  - User disabled ads: never show
 */
export function useAdBanner() {
  const userId = useAdBannerStore((s) => s.userId);
  const adsEnabled = useAdBannerStore((s) => s.adsEnabled);
  const recordShown = useAdBannerStore((s) => s.recordShown);
  const shouldShowOnColdStart = useAdBannerStore((s) => s.shouldShowOnColdStart);
  const shouldShowOnForeground = useAdBannerStore((s) => s.shouldShowOnForeground);

  // SDK init + cold-start ad
  useEffect(() => {
    admobInit().catch(console.warn);

    if (adsEnabled && shouldShowOnColdStart()) {
      showBanner(userId, recordShown);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Background → foreground detection (visibilitychange)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        if (adsEnabled && shouldShowOnForeground()) {
          showBanner(userId, recordShown);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [adsEnabled, userId, recordShown, shouldShowOnForeground]);

  // When user disables ads, hide immediately
  useEffect(() => {
    if (!adsEnabled) {
      hideBanner();
    }
  }, [adsEnabled]);

  return {
    hideBanner,
  };
}
