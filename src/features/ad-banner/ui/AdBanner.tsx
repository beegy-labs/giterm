import { useAdBannerStore } from "../model/adBannerStore";
import { useAdBanner } from "../model/useAdBanner";

/**
 * AdBanner — mounts the AdMob banner logic.
 *
 * The actual native banner view is managed by the ObjC bridge (AdMobBridge.m).
 * This component only handles:
 *   - SDK init + display logic via useAdBanner()
 *   - Exposing setAdsEnabled for the settings UI
 *
 * No visible DOM element is rendered here — the banner is a native UIView.
 */
export function AdBanner() {
  useAdBanner(); // side-effects only
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
