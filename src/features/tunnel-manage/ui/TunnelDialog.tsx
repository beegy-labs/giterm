import { useState, useCallback } from "react";
import { Plus, Trash2, Circle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useTunnelStore, type TunnelConfig } from "@/entities/tunnel";
import { useSessionStore } from "@/entities/session";
import { tunnelStart, tunnelStop } from "../adapters/api/tunnelApi";

interface TunnelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TunnelDialog({ open, onOpenChange }: TunnelDialogProps) {
  const activeSession = useSessionStore((s) => s.activeSession);
  const tunnels = useTunnelStore((s) => s.tunnels);
  const addTunnel = useTunnelStore((s) => s.addTunnel);
  const removeTunnel = useTunnelStore((s) => s.removeTunnel);
  const updateTunnel = useTunnelStore((s) => s.updateTunnel);

  const [name, setName] = useState("");
  const [localPort, setLocalPort] = useState("");
  const [remoteHost, setRemoteHost] = useState("127.0.0.1");
  const [remotePort, setRemotePort] = useState("");
  const [error, setError] = useState("");

  const sessionTunnels = tunnels.filter(
    (t) => t.sessionId === activeSession?.sessionId,
  );

  const handleAdd = useCallback(async () => {
    if (!activeSession?.sessionId) return;
    setError("");

    const tunnelId = crypto.randomUUID();
    const lp = parseInt(localPort, 10);
    const rp = parseInt(remotePort, 10);

    if (!lp || !rp) {
      setError("Invalid port numbers");
      return;
    }

    try {
      await tunnelStart(
        tunnelId,
        activeSession.sessionId,
        lp,
        remoteHost || "127.0.0.1",
        rp,
      );

      addTunnel({
        id: tunnelId,
        name: name || `${lp} -> ${remoteHost}:${rp}`,
        connectionId: activeSession.connectionId,
        sessionId: activeSession.sessionId,
        localPort: lp,
        remoteHost: remoteHost || "127.0.0.1",
        remotePort: rp,
        status: "active",
      });

      setName("");
      setLocalPort("");
      setRemotePort("");
    } catch (err) {
      setError(String(err));
    }
  }, [activeSession, name, localPort, remoteHost, remotePort, addTunnel]);

  const handleRemove = useCallback(
    async (tunnel: TunnelConfig) => {
      try {
        await tunnelStop(tunnel.id);
      } catch {
        // ignore errors on stop
      }
      removeTunnel(tunnel.id);
    },
    [removeTunnel],
  );

  const handleToggle = useCallback(
    async (tunnel: TunnelConfig) => {
      if (tunnel.status === "active") {
        try {
          await tunnelStop(tunnel.id);
          updateTunnel(tunnel.id, { status: "stopped" });
        } catch (err) {
          updateTunnel(tunnel.id, { status: "error", error: String(err) });
        }
      } else {
        try {
          await tunnelStart(
            tunnel.id,
            tunnel.sessionId,
            tunnel.localPort,
            tunnel.remoteHost,
            tunnel.remotePort,
          );
          updateTunnel(tunnel.id, { status: "active", error: undefined });
        } catch (err) {
          updateTunnel(tunnel.id, { status: "error", error: String(err) });
        }
      }
    },
    [updateTunnel],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>SSH Tunnels</DialogTitle>
        </DialogHeader>

        {sessionTunnels.length > 0 && (
          <div className="flex flex-col gap-2">
            {sessionTunnels.map((tunnel) => (
              <div
                key={tunnel.id}
                className="flex items-center gap-2 rounded-sm border border-border p-2 text-xs"
              >
                <button onClick={() => handleToggle(tunnel)}>
                  <Circle
                    className={`size-3 ${
                      tunnel.status === "active"
                        ? "fill-green-500 text-green-500"
                        : tunnel.status === "error"
                          ? "fill-red-500 text-red-500"
                          : "fill-muted text-muted"
                    }`}
                  />
                </button>
                <span className="flex-1 truncate">
                  {tunnel.name} ({tunnel.localPort} -{">"}{" "}
                  {tunnel.remoteHost}:{tunnel.remotePort})
                </span>
                <button
                  onClick={() => handleRemove(tunnel)}
                  className="flex size-5 items-center justify-center rounded-sm hover:bg-destructive/10"
                >
                  <Trash2 className="size-3 text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-3 border-t border-border pt-3">
          <div className="grid grid-cols-4 items-center gap-3">
            <Label className="text-right text-xs">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional"
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-3">
            <Label className="text-right text-xs">Local</Label>
            <Input
              value={localPort}
              onChange={(e) => setLocalPort(e.target.value)}
              placeholder="8080"
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-3">
            <Label className="text-right text-xs">Remote</Label>
            <div className="col-span-3 flex gap-2">
              <Input
                value={remoteHost}
                onChange={(e) => setRemoteHost(e.target.value)}
                placeholder="127.0.0.1"
                className="flex-1"
              />
              <Input
                value={remotePort}
                onChange={(e) => setRemotePort(e.target.value)}
                placeholder="3306"
                className="w-20"
              />
            </div>
          </div>
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!localPort || !remotePort || !activeSession?.sessionId}
          >
            <Plus className="size-3.5" />
            Add Tunnel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
