import { useIsMobile } from "@/shared/lib/useIsMobile";
import { useKeyboardShortcuts } from "@/widgets/keyboard-shortcuts";
import { Sidebar } from "@/widgets/sidebar";
import { TabBar } from "@/widgets/tab-bar";
import { TerminalView } from "@/widgets/terminal-view";
import { MobileLayout } from "@/widgets/mobile-layout";
import {
  ConnectionDialog,
  HostKeyVerifyDialog,
  closeSession,
} from "@/features/ssh-connect";

function DesktopLayout() {
  useKeyboardShortcuts();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <TabBar onCloseSession={closeSession} />
        <TerminalView />
      </main>
      <ConnectionDialog />
      <HostKeyVerifyDialog />
    </div>
  );
}

export function TerminalPage() {
  const isMobile = useIsMobile();
  return isMobile ? (
    <MobileLayout terminalView={<TerminalView showToolbar />} />
  ) : (
    <DesktopLayout />
  );
}
