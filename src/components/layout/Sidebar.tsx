import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useConnectionStore } from "@/stores/connection-store";
import { useAppStore } from "@/stores/app-store";
import { useTerminalStore } from "@/stores/terminal-store";

export function Sidebar() {
  const connections = useConnectionStore((s) => s.connections);
  const removeConnection = useConnectionStore((s) => s.removeConnection);
  const setConnectionDialogOpen = useAppStore((s) => s.setConnectionDialogOpen);
  const activeSession = useTerminalStore((s) => s.activeSession);

  return (
    <div className="flex h-full w-60 flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-3">
        <h2 className="text-sm font-semibold">Connections</h2>
        <Button variant="outline" size="sm" onClick={() => setConnectionDialogOpen(true)}>
          + New
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {connections.length === 0 ? (
            <p className="p-3 text-center text-xs text-muted-foreground">
              No saved connections
            </p>
          ) : (
            connections.map((conn) => (
              <div
                key={conn.id}
                className={`group mb-1 flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                  activeSession?.connectionId === conn.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{conn.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {conn.username}@{conn.host}:{conn.port}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeConnection(conn.id);
                  }}
                >
                  x
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
