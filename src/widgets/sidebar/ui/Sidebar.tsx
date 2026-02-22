import { useCallback, useState } from "react";
import { Plus, Terminal, ArrowRightLeft } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { ScrollArea } from "@/shared/ui/scroll-area";
import {
  useConnectionStore,
  ConnectionItem,
  type ConnectionConfig,
} from "@/entities/connection";
import { useSessionStore } from "@/entities/session";
import {
  useConnectDialogStore,
  connectFromConfig,
  classifySshError,
} from "@/features/ssh-connect";
import { TunnelDialog } from "@/features/tunnel-manage";
import { useServerStats } from "@/features/server-monitor";
import { ServerDashboard } from "@/widgets/server-dashboard";

export function Sidebar() {
  const [tunnelDialogOpen, setTunnelDialogOpen] = useState(false);
  const activeSession = useSessionStore((s) => s.activeSession);
  const monitorSessionId =
    activeSession?.status === "connected" ? activeSession.sessionId : undefined;
  const { stats } = useServerStats(monitorSessionId);
  const connections = useConnectionStore((s) => s.connections);
  const removeConnection = useConnectionStore((s) => s.removeConnection);
  const duplicateConnection = useConnectionStore((s) => s.duplicateConnection);
  const setDialogOpen = useConnectDialogStore((s) => s.setOpen);
  const openEdit = useConnectDialogStore((s) => s.openEdit);
  const sessions = useSessionStore((s) => s.sessions);
  const addSession = useSessionStore((s) => s.addSession);
  const canAddMore = useSessionStore((s) => s.canAddMore);
  const setActiveBySessionId = useSessionStore((s) => s.setActiveBySessionId);
  const getSessionByConnectionId = useSessionStore(
    (s) => s.getSessionByConnectionId,
  );

  const handleConnect = useCallback(
    async (connection: ConnectionConfig) => {
      // If there's already an active session for this connection, switch to it
      const existing = getSessionByConnectionId(connection.id);
      if (existing) {
        setActiveBySessionId(existing.sessionId);
        return;
      }

      if (!canAddMore()) return;

      // Create a placeholder session in "connecting" state
      const placeholderId = `connecting-${connection.id}`;
      addSession({
        sessionId: placeholderId,
        connectionId: connection.id,
        connectionName: connection.name,
        status: "connecting",
      });

      try {
        const sessionId = await connectFromConfig(connection);
        // Replace placeholder with real session
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
    [addSession, canAddMore, getSessionByConnectionId, setActiveBySessionId],
  );

  const activeSessionCount = (connectionId: string) =>
    sessions.filter(
      (s) =>
        s.connectionId === connectionId &&
        (s.status === "connected" || s.status === "connecting"),
    ).length;

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
              const count = activeSessionCount(conn.id);
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
