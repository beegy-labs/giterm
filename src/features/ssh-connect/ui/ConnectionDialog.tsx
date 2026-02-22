import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useConnectionStore, type AuthMethod } from "@/entities/connection";
import { useConnectDialogStore } from "@/features/ssh-connect/model/connectStore";
import { useConnect } from "@/features/ssh-connect/model/useConnect";
import { useConnectionValidation } from "@/features/ssh-connect/model/useConnectionValidation";
import {
  sshTestConnection,
  classifySshError,
} from "@/features/ssh-connect/adapters/api/sshApi";

type TestStatus = "idle" | "testing" | "success" | "failed";

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  className,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className={`relative ${className ?? ""}`}>
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="pr-9"
      />
      <button
        type="button"
        tabIndex={-1}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        onClick={() => setShow((p) => !p)}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function ConnectionDialog() {
  const open = useConnectDialogStore((s) => s.open);
  const setOpen = useConnectDialogStore((s) => s.setOpen);
  const editingConnection = useConnectDialogStore((s) => s.editingConnection);
  const updateConnection = useConnectionStore((s) => s.updateConnection);
  const { connect, connecting, error, setError } = useConnect();

  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [username, setUsername] = useState("");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("password");
  const [password, setPassword] = useState("");
  const [keyPath, setKeyPath] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [startupCommand, setStartupCommand] = useState("");

  const [showJumpHost, setShowJumpHost] = useState(false);
  const [jumpHost, setJumpHost] = useState("");
  const [jumpPort, setJumpPort] = useState("22");
  const [jumpUsername, setJumpUsername] = useState("");
  const [jumpAuthMethod, setJumpAuthMethod] = useState<AuthMethod>("password");
  const [jumpPassword, setJumpPassword] = useState("");
  const [jumpKeyPath, setJumpKeyPath] = useState("");
  const [jumpPassphrase, setJumpPassphrase] = useState("");

  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testError, setTestError] = useState("");

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const markTouched = useCallback(
    (field: string) => setTouched((p) => ({ ...p, [field]: true })),
    [],
  );

  const { errors, isValid } = useConnectionValidation(
    { name, host, port, username },
    touched,
  );

  const isEditing = !!editingConnection;

  useEffect(() => {
    if (editingConnection) {
      setName(editingConnection.name);
      setHost(editingConnection.host);
      setPort(String(editingConnection.port));
      setUsername(editingConnection.username);
      setAuthMethod(editingConnection.authMethod);
      setPassword(editingConnection.password ?? "");
      setKeyPath(editingConnection.keyPath ?? "");
      setPassphrase(editingConnection.passphrase ?? "");
      setStartupCommand(editingConnection.startupCommand ?? "");
      if (editingConnection.jumpHost) {
        setShowJumpHost(true);
        setJumpHost(editingConnection.jumpHost);
        setJumpPort(String(editingConnection.jumpPort ?? 22));
        setJumpUsername(editingConnection.jumpUsername ?? "");
        setJumpAuthMethod(editingConnection.jumpAuthMethod ?? "password");
        setJumpPassword(editingConnection.jumpPassword ?? "");
        setJumpKeyPath(editingConnection.jumpKeyPath ?? "");
        setJumpPassphrase(editingConnection.jumpPassphrase ?? "");
      }
    }
  }, [editingConnection]);

  const buildConfig = () => ({
    id: editingConnection?.id ?? "test",
    name: name || "Test",
    host,
    port: parseInt(port, 10),
    username,
    authMethod,
    password: authMethod === "password" ? password : undefined,
    keyPath: authMethod === "private-key" ? keyPath : undefined,
    passphrase: authMethod === "private-key" ? passphrase : undefined,
    startupCommand: startupCommand || undefined,
    ...(showJumpHost && jumpHost
      ? {
          jumpHost,
          jumpPort: parseInt(jumpPort, 10),
          jumpUsername: jumpUsername || undefined,
          jumpAuthMethod,
          jumpPassword:
            jumpAuthMethod === "password" ? jumpPassword : undefined,
          jumpKeyPath:
            jumpAuthMethod === "private-key" ? jumpKeyPath : undefined,
          jumpPassphrase:
            jumpAuthMethod === "private-key" ? jumpPassphrase : undefined,
        }
      : {}),
  });

  const handleTest = async () => {
    setTestStatus("testing");
    setTestError("");
    try {
      await sshTestConnection(buildConfig());
      setTestStatus("success");
    } catch (err) {
      setTestStatus("failed");
      setTestError(classifySshError(err));
    }
  };

  const handleConnect = () => {
    connect({
      name,
      host,
      port: parseInt(port, 10),
      username,
      authMethod,
      password,
      keyPath,
      passphrase,
      startupCommand,
      ...(showJumpHost && jumpHost
        ? {
            jumpHost,
            jumpPort: parseInt(jumpPort, 10),
            jumpUsername,
            jumpAuthMethod,
            jumpPassword,
            jumpKeyPath,
            jumpPassphrase,
          }
        : {}),
    });
  };

  const handleSave = () => {
    if (!editingConnection) return;
    updateConnection(editingConnection.id, {
      name,
      host,
      port: parseInt(port, 10),
      username,
      authMethod,
      password: authMethod === "password" ? password : undefined,
      keyPath: authMethod === "private-key" ? keyPath : undefined,
      passphrase: authMethod === "private-key" ? passphrase : undefined,
      startupCommand: startupCommand || undefined,
      jumpHost: showJumpHost ? jumpHost || undefined : undefined,
      jumpPort: showJumpHost ? parseInt(jumpPort, 10) : undefined,
      jumpUsername: showJumpHost ? jumpUsername || undefined : undefined,
      jumpAuthMethod: showJumpHost ? jumpAuthMethod : undefined,
      jumpPassword:
        showJumpHost && jumpAuthMethod === "password"
          ? jumpPassword
          : undefined,
      jumpKeyPath:
        showJumpHost && jumpAuthMethod === "private-key"
          ? jumpKeyPath
          : undefined,
      jumpPassphrase:
        showJumpHost && jumpAuthMethod === "private-key"
          ? jumpPassphrase
          : undefined,
    });
    setOpen(false);
  };

  const resetForm = () => {
    setName("");
    setHost("");
    setPort("22");
    setUsername("");
    setPassword("");
    setKeyPath("");
    setPassphrase("");
    setStartupCommand("");
    setShowJumpHost(false);
    setJumpHost("");
    setJumpPort("22");
    setJumpUsername("");
    setJumpAuthMethod("password");
    setJumpPassword("");
    setJumpKeyPath("");
    setJumpPassphrase("");
    setError("");
    setTestStatus("idle");
    setTestError("");
    setTouched({});
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {isEditing ? "Edit Connection" : "New Connection"}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-1 py-4 [touch-action:pan-y] [-webkit-overflow-scrolling:touch]">
          <div className="grid gap-4">
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="name" className="pt-2 text-right">
              Name
            </Label>
            <div className="col-span-3">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => markTouched("name")}
                placeholder="My Server"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-destructive">{errors.name}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="host" className="pt-2 text-right">
              Host
            </Label>
            <div className="col-span-3">
              <Input
                id="host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                onBlur={() => markTouched("host")}
                placeholder="example.com"
              />
              {errors.host && (
                <p className="mt-1 text-xs text-destructive">{errors.host}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="port" className="pt-2 text-right">
              Port
            </Label>
            <div className="col-span-3">
              <Input
                id="port"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                onBlur={() => markTouched("port")}
              />
              {errors.port && (
                <p className="mt-1 text-xs text-destructive">{errors.port}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="username" className="pt-2 text-right">
              Username
            </Label>
            <div className="col-span-3">
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onBlur={() => markTouched("username")}
              />
              {errors.username && (
                <p className="mt-1 text-xs text-destructive">
                  {errors.username}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="pt-2 text-right">Auth</Label>
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
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="password" className="pt-2 text-right">
                Password
              </Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="col-span-3"
              />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="keyPath" className="pt-2 text-right">
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
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="passphrase" className="pt-2 text-right">
                  Passphrase
                </Label>
                <PasswordInput
                  id="passphrase"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Optional"
                  className="col-span-3"
                />
              </div>
            </>
          )}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="startupCommand" className="pt-2 text-right">
              Startup
            </Label>
            <Input
              id="startupCommand"
              value={startupCommand}
              onChange={(e) => setStartupCommand(e.target.value)}
              placeholder="e.g. cd /app && ls"
              className="col-span-3"
            />
          </div>

          {/* Jump Host Section */}
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowJumpHost((p) => !p)}
          >
            {showJumpHost ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
            Jump Host
          </button>
          {showJumpHost && (
            <>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="jumpHost" className="pt-2 text-right text-xs">
                  Host
                </Label>
                <Input
                  id="jumpHost"
                  value={jumpHost}
                  onChange={(e) => setJumpHost(e.target.value)}
                  placeholder="jump.example.com"
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="jumpPort" className="pt-2 text-right text-xs">
                  Port
                </Label>
                <Input
                  id="jumpPort"
                  value={jumpPort}
                  onChange={(e) => setJumpPort(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="jumpUsername" className="pt-2 text-right text-xs">
                  Username
                </Label>
                <Input
                  id="jumpUsername"
                  value={jumpUsername}
                  onChange={(e) => setJumpUsername(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="pt-2 text-right text-xs">Auth</Label>
                <Select
                  value={jumpAuthMethod}
                  onValueChange={(v) => setJumpAuthMethod(v as AuthMethod)}
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
              {jumpAuthMethod === "password" ? (
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="jumpPassword" className="pt-2 text-right text-xs">
                    Password
                  </Label>
                  <PasswordInput
                    id="jumpPassword"
                    value={jumpPassword}
                    onChange={(e) => setJumpPassword(e.target.value)}
                    className="col-span-3"
                  />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label
                      htmlFor="jumpKeyPath"
                      className="pt-2 text-right text-xs"
                    >
                      Key Path
                    </Label>
                    <Input
                      id="jumpKeyPath"
                      value={jumpKeyPath}
                      onChange={(e) => setJumpKeyPath(e.target.value)}
                      placeholder="~/.ssh/id_ed25519"
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label
                      htmlFor="jumpPassphrase"
                      className="pt-2 text-right text-xs"
                    >
                      Passphrase
                    </Label>
                    <PasswordInput
                      id="jumpPassphrase"
                      value={jumpPassphrase}
                      onChange={(e) => setJumpPassphrase(e.target.value)}
                      placeholder="Optional"
                      className="col-span-3"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {(error || testError) && (
            <div className="rounded-sm bg-destructive/10 p-3 text-sm text-destructive">
              {error || testError}
            </div>
          )}
          {testStatus === "success" && (
            <div className="flex items-center gap-2 rounded-sm bg-green-500/10 p-3 text-sm text-green-600">
              <CheckCircle2 className="size-4" />
              Connection successful
            </div>
          )}
          </div>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-border pt-4">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testStatus === "testing" || !host || !username}
          >
            {testStatus === "testing" ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Testing...
              </>
            ) : testStatus === "success" ? (
              <>
                <CheckCircle2 className="size-4" />
                Test
              </>
            ) : testStatus === "failed" ? (
              <>
                <XCircle className="size-4" />
                Test
              </>
            ) : (
              "Test"
            )}
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          {isEditing ? (
            <Button onClick={handleSave} disabled={!isValid}>
              Save
            </Button>
          ) : (
            <Button
              onClick={handleConnect}
              disabled={connecting || !isValid}
            >
              {connecting ? "Connecting..." : "Connect"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
