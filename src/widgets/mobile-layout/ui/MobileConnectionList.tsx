import { Plus, Terminal } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { MobileScreen } from "@/shared/ui/mobile-screen";
import {
  useConnectDialogStore,
  startSession,
} from "@/features/ssh-connect";
import {
  useConnectionStore,
  ConnectionItem,
} from "@/entities/connection";
import { useSessionStore, selectActiveSession } from "@/entities/session";
import { ChevronLeft } from "lucide-react";

export function MobileConnectionList({ onBack }: { onBack?: () => void }) {
  const connections = useConnectionStore((s) => s.connections);
  const removeConnection = useConnectionStore((s) => s.removeConnection);
  const setDialogOpen = useConnectDialogStore((s) => s.setOpen);
  const openEdit = useConnectDialogStore((s) => s.openEdit);
  const activeSession = useSessionStore(selectActiveSession);
  return (
    <MobileScreen name="ConnectionList">
      <MobileScreen.Header name="ConnectionList.Header" className="justify-between px-4">
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
      </MobileScreen.Header>
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
