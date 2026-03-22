import { Plus, Terminal } from "lucide-react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { MobileScreen } from "@/shared/ui/mobile-screen";
import { EmptyState } from "@/shared/ui/empty-state";
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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDialogOpen(true)}
          className="shrink-0"
        >
          <Plus className="size-5" />
        </Button>
      </MobileScreen.Header>

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
