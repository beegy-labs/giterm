import { useAdBannerStore } from "../model/adBannerStore";
import { useAdBanner, hideBanner } from "../model/useAdBanner";
import { CoupangBanner } from "./CoupangBanner";

/**
 * AdBanner — mounts ad logic and renders the appropriate banner.
 *
 * - admob: native UIView managed by Rust/ObjC2. Renders a close button overlay.
 * - coupang: DOM-based carousel banner with close button.
 */
export function AdBanner() {
  useAdBanner();
  const bannerType = useAdBannerStore((s) => s.bannerType);

  if (bannerType === "coupang") {
    return <CoupangBanner onClose={hideBanner} />;
  }

  if (bannerType === "admob") {
    return (
      <div className="relative" style={{ height: "50px" }}>
        {/* Close button overlaid on native AdMob UIView */}
        <button
          type="button"
          onClick={hideBanner}
          className="absolute right-1 top-1 z-50 flex size-5 items-center justify-center rounded-full bg-black/40 text-[10px] text-white hover:bg-black/60"
          aria-label="광고 닫기"
        >
          ×
        </button>
      </div>
    );
  }

  return null;
}

/** Small toggle for settings — lets the user disable ads */
export function AdToggle({ className }: { className?: string }) {
  const adsEnabled = useAdBannerStore((s) => s.adsEnabled);
  const setAdsEnabled = useAdBannerStore((s) => s.setAdsEnabled);

  return (
    <button
      type="button"
      onClick={() => setAdsEnabled(!adsEnabled)}
      className={`flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground ${className ?? ""}`}
    >
      <span
        className={`inline-block size-1.5 rounded-full ${adsEnabled ? "bg-primary" : "bg-muted-foreground/40"}`}
      />
      {adsEnabled ? "ads on" : "ads off"}
    </button>
  );
}
