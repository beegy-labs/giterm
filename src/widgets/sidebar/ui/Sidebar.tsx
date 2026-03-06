import { useCallback, useState } from "react";
import { Plus, Terminal, ArrowRightLeft } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { ScrollArea } from "@/shared/ui/scroll-area";
import {
  useConnectionStore,
  ConnectionItem,
  type ConnectionConfig,
} from "@/entities/connection";
import {
  useSessionStore,
  selectActiveSession,
  selectSessionByConnectionId,
  MAX_SESSIONS,
} from "@/entities/session";
import {
  useConnectDialogStore,
  startSession,
} from "@/features/ssh-connect";
import { TunnelDialog } from "@/features/tunnel-manage";
import { useServerStats } from "@/features/server-monitor";
import { ServerDashboard } from "./ServerDashboard";

export function Sidebar() {
  const [tunnelDialogOpen, setTunnelDialogOpen] = useState(false);
  const activeSession = useSessionStore(selectActiveSession);
  const monitorSessionId =
    activeSession?.status === "connected" ? activeSession.sessionId : undefined;
  const { stats } = useServerStats(monitorSessionId);
  const connections = useConnectionStore((s) => s.connections);
  const removeConnection = useConnectionStore((s) => s.removeConnection);
  const duplicateConnection = useConnectionStore((s) => s.duplicateConnection);
  const setDialogOpen = useConnectDialogStore((s) => s.setOpen);
  const openEdit = useConnectDialogStore((s) => s.openEdit);
  const sessions = useSessionStore((s) => s.sessions);
  const canAddMore = sessions.length < MAX_SESSIONS;
  const setActiveBySessionId = useSessionStore((s) => s.setActiveBySessionId);
  const handleConnect = useCallback(
    async (connection: ConnectionConfig) => {
      // If there's already an active session for this connection, switch to it
      const existing = selectSessionByConnectionId(connection.id)(
        useSessionStore.getState(),
      );
      if (existing) {
        setActiveBySessionId(existing.sessionId);
        return;
      }

      if (!canAddMore) return;

      await startSession(connection, connection.name);
    },
    [canAddMore, setActiveBySessionId],
  );

  const countByConnection = new Map<string, number>();
  sessions.forEach((s) => {
    if (s.connectionId && s.status !== "disconnected") {
      countByConnection.set(s.connectionId, (countByConnection.get(s.connectionId) ?? 0) + 1);
    }
  });

  return (
    <div className="flex h-full w-56 flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-3">
        <h2 className="text-sm font-semibold">Connections</h2>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="size-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {connections.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <Terminal className="size-10 text-primary/30" />
              <p className="text-center text-xs text-muted-foreground">
                No saved connections
              </p>
            </div>
          ) : (
            connections.map((conn) => {
              const count = countByConnection.get(conn.id) ?? 0;
              return (
                <ConnectionItem
                  key={conn.id}
                  connection={conn}
                  isActive={activeSession?.connectionId === conn.id}
                  activeCount={count}
                  onConnect={() => handleConnect(conn)}
                  onEdit={() => openEdit(conn)}
                  onRemove={() => removeConnection(conn.id)}
                  onDuplicate={() => duplicateConnection(conn.id)}
                />
              );
            })
          )}
        </div>
      </ScrollArea>
      <ServerDashboard stats={stats} />
      <div className="border-t border-border px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-xs"
          onClick={() => setTunnelDialogOpen(true)}
        >
          <ArrowRightLeft className="size-3.5" />
          Tunnels
        </Button>
      </div>
      <TunnelDialog
        open={tunnelDialogOpen}
        onOpenChange={setTunnelDialogOpen}
      />
    </div>
  );
}
