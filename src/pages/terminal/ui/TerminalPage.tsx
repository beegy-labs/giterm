import { useCallback, useState, useEffect } from "react";
import { Plus, Terminal, ChevronLeft, X, List } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { useIsMobile } from "@/shared/lib/useIsMobile";
import { useVisualViewport } from "@/shared/lib/useVisualViewport";
import { useKeyboardShortcuts } from "@/shared/lib/useKeyboardShortcuts";
import { Sidebar } from "@/widgets/sidebar";
import { TabBar } from "@/widgets/tab-bar";
import { TerminalView } from "@/widgets/terminal-view";
import {
  ConnectionDialog,
  useConnectDialogStore,
  connectFromConfig,
  classifySshError,
} from "@/features/ssh-connect";
import {
  useConnectionStore,
  ConnectionItem,
  type ConnectionConfig,
} from "@/entities/connection";
import { useSessionStore, type SessionStatus } from "@/entities/session";
import { cancelReconnect } from "@/features/ssh-reconnect";

function mobileStatusColor(status: SessionStatus): string {
  switch (status) {
    case "connected":
      return "bg-green-500";
    case "connecting":
    case "reconnecting":
      return "bg-yellow-500";
    case "disconnected":
    case "error":
      return "bg-red-500";
  }
}

function useReconnect() {
  const addSession = useSessionStore((s) => s.addSession);

  return useCallback(
    async (connection: ConnectionConfig) => {
      const placeholderId = `connecting-${connection.id}`;
      addSession({
        sessionId: placeholderId,
        connectionId: connection.id,
        connectionName: connection.name,
        status: "connecting",
      });

      try {
        const sessionId = await connectFromConfig(connection);
        useSessionStore.getState().updateSession(placeholderId, {
          sessionId,
          status: "connected",
        });
      } catch (err) {
        useSessionStore.getState().updateSession(placeholderId, {
          status: "error",
          error: classifySshError(err),
        });
      }
    },
    [addSession],
  );
}

function MobileConnectionList({ onBack }: { onBack?: () => void }) {
  const connections = useConnectionStore((s) => s.connections);
  const removeConnection = useConnectionStore((s) => s.removeConnection);
  const setDialogOpen = useConnectDialogStore((s) => s.setOpen);
  const openEdit = useConnectDialogStore((s) => s.openEdit);
  const activeSession = useSessionStore((s) => s.activeSession);
  const reconnect = useReconnect();

  return (
    <div className="flex h-full flex-col bg-background pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="icon-sm" onClick={onBack}>
              <ChevronLeft className="size-5" />
            </Button>
          )}
          <h1 className="text-lg font-semibold">Connections</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="size-5" />
        </Button>
      </div>
      <ScrollArea className="flex-1 [touch-action:pan-y]">
        <div className="flex flex-col gap-4 p-4">
          {connections.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16">
              <Terminal className="size-16 text-primary/20" />
              <p className="text-base text-muted-foreground">
                No saved connections
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="size-4" />
                Add Connection
              </Button>
            </div>
          ) : (
            connections.map((conn) => (
              <ConnectionItem
                key={conn.id}
                connection={conn}
                isActive={activeSession?.connectionId === conn.id}
                isMobile
                onConnect={() => reconnect(conn)}
                onEdit={() => openEdit(conn)}
                onRemove={() => removeConnection(conn.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function MobileTerminalScreen({
  onShowConnections,
}: {
  onShowConnections: () => void;
}) {
  const sessions = useSessionStore((s) => s.sessions);
  const activeIndex = useSessionStore((s) => s.activeIndex);
  const setActiveIndex = useSessionStore((s) => s.setActiveIndex);
  const removeSession = useSessionStore((s) => s.removeSession);
  const setDialogOpen = useConnectDialogStore((s) => s.setOpen);

  const handleClose = useCallback(
    async (sessionId: string) => {
      cancelReconnect(sessionId);
      const session = sessions.find((s) => s.sessionId === sessionId);
      if (session?.status === "connected") {
        const { sshDisconnect } = await import("@/features/ssh-connect");
        await sshDisconnect(sessionId).catch(console.error);
      }
      removeSession(sessionId);
    },
    [sessions, removeSession],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)]">
      {/* Mini tab bar */}
      <div className="flex shrink-0 items-center border-b border-border">
        <button
          className="flex shrink-0 items-center justify-center px-2.5 py-2 text-muted-foreground active:text-foreground"
          onClick={onShowConnections}
        >
          <List className="size-4" />
        </button>

        <div className="flex flex-1 items-center gap-0.5 overflow-x-auto py-1">
          {sessions.map((s, i) => (
            <button
              key={s.sessionId}
              className={`flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-1 text-xs ${
                i === activeIndex
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground active:text-foreground"
              }`}
              onClick={() => setActiveIndex(i)}
            >
              <span
                className={`size-1.5 rounded-full ${mobileStatusColor(s.status)}`}
              />
              <span className="max-w-20 truncate">{s.connectionName}</span>
              <span
                className="flex size-3.5 items-center justify-center rounded-sm text-muted-foreground active:bg-accent"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose(s.sessionId);
                }}
              >
                <X className="size-2.5" />
              </span>
            </button>
          ))}
        </div>

        {sessions.length < 5 && (
          <button
            className="flex shrink-0 items-center justify-center px-2.5 py-2 text-muted-foreground active:text-foreground"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-4" />
          </button>
        )}
      </div>
      <TerminalView showToolbar />
    </div>
  );
}

function MobileLayout() {
  const sessions = useSessionStore((s) => s.sessions);
  const viewportHeight = useVisualViewport();
  const [showConnections, setShowConnections] = useState(true);

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
    <div
      className="w-screen overflow-hidden bg-background text-foreground"
      style={{ height: viewportHeight }}
    >
      {showConnections ? (
        <MobileConnectionList
          onBack={
            sessions.length > 0
              ? () => setShowConnections(false)
              : undefined
          }
        />
      ) : (
        <MobileTerminalScreen
          onShowConnections={() => setShowConnections(true)}
        />
      )}
      <ConnectionDialog />
    </div>
  );
}

function DesktopLayout() {
  useKeyboardShortcuts();
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <TabBar />
        <TerminalView />
      </main>
      <ConnectionDialog />
    </div>
  );
}

export function TerminalPage() {
  const isMobile = useIsMobile();
  return isMobile ? <MobileLayout /> : <DesktopLayout />;
}
