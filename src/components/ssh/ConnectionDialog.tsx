import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/stores/app-store";
import { useConnectionStore, type AuthMethod } from "@/stores/connection-store";
import { useTerminalStore } from "@/stores/terminal-store";

export function ConnectionDialog() {
  const open = useAppStore((s) => s.connectionDialogOpen);
  const setOpen = useAppStore((s) => s.setConnectionDialogOpen);
  const addConnection = useConnectionStore((s) => s.addConnection);
  const setActiveSession = useTerminalStore((s) => s.setActiveSession);

  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("password");
  const [password, setPassword] = useState("");
  const [keyPath, setKeyPath] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const handleConnect = async () => {
    setConnecting(true);
    setError("");

    try {
      const config =
        authMethod === "password"
          ? {
              host,
              port: parseInt(port, 10),
              username,
              authMethod: { type: "password" as const, password },
            }
          : {
              host,
              port: parseInt(port, 10),
              username,
              authMethod: {
                type: "privateKey" as const,
                keyPath,
                passphrase: passphrase || null,
              },
            };

      const sessionId = await invoke<string>("ssh_connect", { config });

      const connectionId = crypto.randomUUID();
      addConnection({
        id: connectionId,
        name: `${username}@${host}`,
        host,
        port: parseInt(port, 10),
        username,
        authMethod,
      });

      setActiveSession({
        sessionId,
        connectionId,
        status: "connected",
      });

      setOpen(false);
      resetForm();
    } catch (err) {
      setError(String(err));
    } finally {
      setConnecting(false);
    }
  };

  const resetForm = () => {
    setHost("");
    setPort("22");
    setUsername("");
    setPassword("");
    setKeyPath("");
    setPassphrase("");
    setError("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New SSH Connection</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="host" className="text-right">
              Host
            </Label>
            <Input
              id="host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="example.com"
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="port" className="text-right">
              Port
            </Label>
            <Input
              id="port"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="username" className="text-right">
              Username
            </Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Auth</Label>
            <Select
              value={authMethod}
              onValueChange={(v) => setAuthMethod(v as AuthMethod)}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="password">Password</SelectItem>
                <SelectItem value="private-key">Private Key</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {authMethod === "password" ? (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="col-span-3"
              />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="keyPath" className="text-right">
                  Key Path
                </Label>
                <Input
                  id="keyPath"
                  value={keyPath}
                  onChange={(e) => setKeyPath(e.target.value)}
                  placeholder="~/.ssh/id_ed25519"
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="passphrase" className="text-right">
                  Passphrase
                </Label>
                <Input
                  id="passphrase"
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Optional"
                  className="col-span-3"
                />
              </div>
            </>
          )}
          {error && (
            <div className="col-span-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={connecting || !host || !username}
          >
            {connecting ? "Connecting..." : "Connect"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
