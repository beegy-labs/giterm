import { useEffect } from "react";
import { useAdBannerStore } from "./adBannerStore";
import { admobRequestAtt, admobInit, admobBannerShow, admobBannerHide } from "../adapters/api/adBannerApi";

const AD_UNIT_ID = import.meta.env.DEV
  ? "ca-app-pub-3940256099942544/2934735716" // Google test banner
  : "ca-app-pub-5019286268878126/8296487753";

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

async function showAdmobBanner(userId: string, recordShown: () => void) {
  try {
    const safeAreaTop = getSafeAreaTop();
    await admobBannerShow({ adUnitId: AD_UNIT_ID, userId, safeAreaTop });
    recordShown();
    useAdBannerStore.getState().setBannerVisible(true);
    useAdBannerStore.getState().setBannerType("admob");
    document.documentElement.style.setProperty("--ad-banner-h", "50px");
  } catch (err) {
    console.warn("[AdMob] show failed:", err);
  }
}

export function showCoupangBanner(recordShown: () => void) {
  recordShown();
  useAdBannerStore.getState().setBannerVisible(true);
  useAdBannerStore.getState().setBannerType("coupang");
  document.documentElement.style.setProperty("--ad-banner-h", "50px");
}

export async function hideBanner() {
  const { bannerType } = useAdBannerStore.getState();
  if (bannerType === "admob") {
    try { await admobBannerHide(); } catch (err) { console.warn("[AdMob] hide failed:", err); }
  }
  useAdBannerStore.getState().setBannerVisible(false);
  useAdBannerStore.getState().setBannerType("none");
  document.documentElement.style.setProperty("--ad-banner-h", "0px");
}

/**
 * useAdBanner — handles SDK init, cold-start ad, and background-return ad.
 *
 * Display rules:
 *  - Cold start (first ever launch): always show (if ads enabled)
 *  - Background → foreground: show only if ≥ 1 hour since last display
 *  - Ad not available (SDK error): invisible, no space reserved
 *  - User disabled ads: never show
 */
export function useAdBanner() {
  const userId = useAdBannerStore((s) => s.userId);
  const adsEnabled = useAdBannerStore((s) => s.adsEnabled);
  const recordShown = useAdBannerStore((s) => s.recordShown);
  const shouldShowOnColdStart = useAdBannerStore((s) => s.shouldShowOnColdStart);
  const shouldShowOnForeground = useAdBannerStore((s) => s.shouldShowOnForeground);

  // ATT → SDK init → cold-start ad (AdMob if authorized, Coupang if denied)
  useEffect(() => {
    (async () => {
      const attStatus = await admobRequestAtt().catch(() => "denied");
      if (attStatus === "authorized") {
        await admobInit().catch(console.warn);
        if (adsEnabled && shouldShowOnColdStart()) {
          showAdmobBanner(userId, recordShown);
        }
      } else {
        if (adsEnabled && shouldShowOnColdStart()) {
          showCoupangBanner(recordShown);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Background → foreground detection (visibilitychange)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        if (adsEnabled && shouldShowOnForeground()) {
          const { bannerType } = useAdBannerStore.getState();
          if (bannerType === "coupang") {
            showCoupangBanner(recordShown);
          } else {
            showAdmobBanner(userId, recordShown);
          }
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [adsEnabled, userId, recordShown, shouldShowOnForeground]);

  // When user disables ads, hide immediately
  useEffect(() => {
    if (!adsEnabled) hideBanner();
  }, [adsEnabled]);

  return {
    hideBanner,
  };
}
