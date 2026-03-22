import { Plus, Terminal, ChevronRight } from "lucide-react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { MobileScreen } from "@/shared/ui/mobile-screen";
import { EmptyState } from "@/shared/ui/empty-state";
import { ThemeToggle } from "@/shared/ui/theme-toggle";
import {
  useConnectDialogStore,
  startSession,
} from "@/features/ssh-connect";
import {
  useConnectionStore,
  ConnectionItem,
} from "@/entities/connection";
import { useSessionStore, selectActiveSession } from "@/entities/session";

export function MobileConnectionList({ onBack }: { onBack?: () => void }) {
  const connections = useConnectionStore((s) => s.connections);
  const removeConnection = useConnectionStore((s) => s.removeConnection);
  const setDialogOpen = useConnectDialogStore((s) => s.setOpen);
  const openEdit = useConnectDialogStore((s) => s.openEdit);
  const activeSession = useSessionStore(selectActiveSession);
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessions = sessions.filter((s) => s.status !== "disconnected");

  return (
    <MobileScreen name="ConnectionList">
      <MobileScreen.Header name="ConnectionList.Header" className="px-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {onBack && (
            <Button variant="ghost" size="icon-sm" onClick={onBack} className="-ml-1 shrink-0">
              <ChevronLeft className="size-5" />
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold tracking-tight">Connections</h1>
            {connections.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {connections.length} saved
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-5" />
          </Button>
        </div>
      </MobileScreen.Header>

      {/* Active session banner */}
      {onBack && activeSessions.length > 0 && (
        <button
          type="button"
          onClick={onBack}
          className="mx-4 mt-3 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-left transition-colors active:bg-primary/20"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary/20">
              <Terminal className="size-3.5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">
                {activeSessions.length === 1
                  ? (activeSessions[0]?.connectionName ?? "Terminal")
                  : `${activeSessions.length} active sessions`}
              </p>
              <p className="text-xs text-primary/70">Tap to open terminal</p>
            </div>
          </div>
          <ChevronRight className="size-4 text-primary/60" />
        </button>
      )}

      <ScrollArea className="flex-1 [touch-action:pan-y]">
        <div className="flex flex-col gap-3 p-4">
          {connections.length === 0 ? (
            <EmptyState
              icon={<Terminal className="size-16 text-primary/20" />}
              message="No saved connections"
              action={
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="size-4" />
                  Add Connection
                </Button>
              }
            />
          ) : (
            connections.map((conn) => (
              <ConnectionItem
                key={conn.id}
                connection={conn}
                isActive={activeSession?.connectionId === conn.id}
                isMobile
                onConnect={() => startSession(conn, conn.name)}
                onEdit={() => openEdit(conn)}
                onRemove={() => removeConnection(conn.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </MobileScreen>
  );
}
