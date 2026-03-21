import { useState, useEffect, type ReactNode } from "react";
import { vpLogStart, vpLogStop } from "@/shared/adapters/viewportLogApi";
import { DevFrame } from "@/shared/ui/dev-frame";
import { useVisualViewport } from "@/shared/lib/useVisualViewport";
import {
  ConnectionDialog,
  HostKeyVerifyDialog,
} from "@/features/ssh-connect";
import { useSessionStore } from "@/entities/session";
import { AdBanner } from "@/features/ad-banner";
import { MobileConnectionList } from "./MobileConnectionList";
import { MobileSessionTabBar } from "./MobileSessionTabBar";

interface MobileLayoutProps {
  terminalView: ReactNode;
}

export function MobileLayout({ terminalView }: MobileLayoutProps) {
  const sessions = useSessionStore((s) => s.sessions);
  useVisualViewport(); // side-effect only — sets --vvh CSS var
  const [showConnections, setShowConnections] = useState(true);

  // DEV: start viewport log on mount, stop on unmount
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    vpLogStart()
      .then((path) => console.log("[VP LOG]", path))
      .catch(console.error);
    return () => {
      vpLogStop().catch(console.error);
    };
  }, []);

  // Auto-switch to terminal when a new session connects
  useEffect(() => {
    if (sessions.length > 0 && showConnections) {
      setShowConnections(false);
    }
    if (sessions.length === 0) {
      setShowConnections(true);
    }
  }, [sessions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <DevFrame
      name="MobileLayout"
      className="overlay-fullscreen flex flex-col overflow-hidden bg-background text-foreground"
    >
      {/* Fix #2: Always render both views, toggle with display.
       * Conditional rendering (ternary) unmounted the terminal section when
       * viewing the connection list, destroying all xterm instances. */}
      <div className={showConnections ? "flex flex-1 flex-col overflow-hidden" : "hidden"}>
        <MobileConnectionList
          onBack={
            sessions.length > 0
              ? () => setShowConnections(false)
              : undefined
          }
        />
      </div>
      <div
        className={showConnections ? "hidden" : "flex flex-1 flex-col overflow-hidden"}
      >
        <AdBanner />
        <MobileSessionTabBar
          onShowConnections={() => setShowConnections(true)}
        />
        {terminalView}
      </div>
      <ConnectionDialog />
      <HostKeyVerifyDialog />
    </DevFrame>
  );
}
