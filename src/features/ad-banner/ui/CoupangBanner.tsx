import { useEffect, useRef } from "react";

interface CoupangBannerProps {
  onClose: () => void;
}

export function CoupangBanner({ onClose }: CoupangBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const script = document.createElement("script");
    script.src = "https://ads-partners.coupang.com/g.js";
    script.async = true;
    script.onload = () => {
      const w = window as unknown as Record<string, { G: new (opts: object) => void }>;
      if (!w.PartnersCoupang) return;
      new w.PartnersCoupang.G({
        id: 974809,
        template: "carousel",
        trackingCode: "AF6623822",
        width: "340",
        height: "50",
        tsource: "",
      });
    };
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  return (
    <div className="relative flex items-center justify-center bg-background" style={{ height: "50px" }}>
      <div ref={containerRef} className="overflow-hidden" style={{ width: "340px", height: "50px" }} />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/40 text-[10px] text-white hover:bg-black/60"
        aria-label="광고 닫기"
      >
        ×
      </button>
    </div>
  );
}
