import { useState } from "react";
import { useAdBannerStore } from "../model/adBannerStore";
import { admobInit, admobBannerShow, admobBannerHide } from "../adapters/api/adBannerApi";

const TEST_AD_UNIT = "ca-app-pub-3940256099942544/2934735716";

function getSafeAreaTop(): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--sat")
    .trim();
  return parseFloat(raw) || 0;
}

/**
 * DEV-only panel for testing AdMob banner flow.
 * Rendered only when import.meta.env.DEV === true.
 */
export function AdDevPanel() {
  if (!import.meta.env.DEV) return null;

  return <AdDevPanelInner />;
}

function AdDevPanelInner() {
  const userId = useAdBannerStore((s) => s.userId);
  const adsEnabled = useAdBannerStore((s) => s.adsEnabled);
  const setAdsEnabled = useAdBannerStore((s) => s.setAdsEnabled);
  const isBannerVisible = useAdBannerStore((s) => s.isBannerVisible);
  const setBannerVisible = useAdBannerStore((s) => s.setBannerVisible);
  const recordShown = useAdBannerStore((s) => s.recordShown);

  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const push = (msg: string) =>
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 9)]);

  const handleInit = async () => {
    setBusy(true);
    try {
      await admobInit();
      push("✓ SDK init called");
    } catch (e: unknown) {
      push(`✗ init failed: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  const handleShow = async () => {
    setBusy(true);
    try {
      const sat = getSafeAreaTop();
      await admobBannerShow({ adUnitId: TEST_AD_UNIT, userId, safeAreaTop: sat });
      recordShown();
      setBannerVisible(true);
      document.documentElement.style.setProperty("--ad-banner-h", "50px");
      push(`✓ banner show (sat=${sat}px, userId=${userId.slice(0, 8)}…)`);
    } catch (e: unknown) {
      push(`✗ show failed: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  const handleHide = async () => {
    setBusy(true);
    try {
      await admobBannerHide();
      setBannerVisible(false);
      document.documentElement.style.setProperty("--ad-banner-h", "0px");
      push("✓ banner hidden");
    } catch (e: unknown) {
      push(`✗ hide failed: ${e}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSimulate = () => {
    // Simulate the native banner with a CSS-only placeholder (for desktop dev)
    const current = getComputedStyle(document.documentElement)
      .getPropertyValue("--ad-banner-h")
      .trim();
    if (current === "50px") {
      document.documentElement.style.setProperty("--ad-banner-h", "0px");
      setBannerVisible(false);
      push("◎ CSS sim: banner hidden");
    } else {
      document.documentElement.style.setProperty("--ad-banner-h", "50px");
      setBannerVisible(true);
      recordShown();
      push("◎ CSS sim: banner shown (layout only, no native ad)");
    }
  };

  const handleResetCooldown = () => {
    localStorage.removeItem("giterm:ad-last-shown");
    push("↺ lastShown reset — next foreground will show ad");
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 font-mono text-xs">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-500">
          AdMob Dev Panel
        </span>
        <div className="h-px flex-1 bg-amber-500/20" />
        <span className="text-[10px] text-muted-foreground">
          {isBannerVisible ? "● banner on" : "○ banner off"}
        </span>
      </div>

      {/* State info */}
      <div className="space-y-0.5 text-[10px] text-muted-foreground">
        <div>user_id: <span className="text-foreground">{userId.slice(0, 16)}…</span></div>
        <div>ads_enabled: <span className="text-foreground">{String(adsEnabled)}</span></div>
        <div>last_shown: <span className="text-foreground">
          {(() => {
            const t = parseInt(localStorage.getItem("giterm:ad-last-shown") ?? "0", 10);
            return t ? new Date(t).toLocaleTimeString() : "never";
          })()}
        </span></div>
        <div>--ad-banner-h: <span className="text-foreground">
          {getComputedStyle(document.documentElement).getPropertyValue("--ad-banner-h").trim() || "0px"}
        </span></div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={handleInit}
          disabled={busy}
          className="rounded-md border border-border bg-card px-2 py-1.5 text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40"
        >
          init_sdk()
        </button>
        <button
          onClick={handleShow}
          disabled={busy}
          className="rounded-md border border-border bg-card px-2 py-1.5 text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40"
        >
          show_banner()
        </button>
        <button
          onClick={handleHide}
          disabled={busy}
          className="rounded-md border border-border bg-card px-2 py-1.5 text-[10px] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-40"
        >
          hide_banner()
        </button>
        <button
          onClick={handleSimulate}
          className="rounded-md border border-amber-500/30 bg-card px-2 py-1.5 text-[10px] text-muted-foreground transition-colors hover:border-amber-500/60 hover:text-amber-500"
        >
          css_sim_toggle()
        </button>
        <button
          onClick={() => setAdsEnabled(!adsEnabled)}
          className={`rounded-md border px-2 py-1.5 text-[10px] transition-colors ${
            adsEnabled
              ? "border-primary/30 text-primary hover:border-destructive/40 hover:text-destructive"
              : "border-muted text-muted-foreground hover:border-primary/40 hover:text-primary"
          }`}
        >
          {adsEnabled ? "disable_ads()" : "enable_ads()"}
        </button>
        <button
          onClick={handleResetCooldown}
          className="rounded-md border border-border bg-card px-2 py-1.5 text-[10px] text-muted-foreground transition-colors hover:border-amber-500/40 hover:text-amber-500"
        >
          reset_cooldown()
        </button>
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div className="space-y-0.5 rounded-md border border-border bg-background p-2">
          {log.map((line, i) => (
            <div key={i} className="text-[10px] text-muted-foreground">
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
