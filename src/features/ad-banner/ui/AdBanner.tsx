import { DevFrame } from "@/shared/ui/dev-frame";
import { useAdBannerStore } from "../model/adBannerStore";

/** Standard mobile banner height (50pt) */
const BANNER_HEIGHT = 50;

/**
 * AdBanner — fixed-height slot for AdMob banner ads.
 *
 * Collapses to zero height when no ad is loaded.
 * TODO: Replace placeholder with actual AdMob SDK integration.
 */
export function AdBanner() {
  const isAdLoaded = useAdBannerStore((s) => s.isAdLoaded);

  if (!isAdLoaded) return null;

  return (
    <DevFrame
      name="AdBanner"
      className="shrink-0 flex items-center justify-center border-b border-border bg-card/50"
      style={{ height: BANNER_HEIGHT }}
    >
      {/* AdMob banner will be rendered here */}
      <span className="text-xs text-muted-foreground">Ad</span>
    </DevFrame>
  );
}
