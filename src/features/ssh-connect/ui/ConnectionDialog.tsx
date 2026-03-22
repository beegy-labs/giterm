import { useState, useEffect } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Terminal,
  FlaskConical,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { FormField } from "@/shared/ui/form-field";
import { InlineAlert } from "@/shared/ui/inline-alert";
import { SectionHeader } from "@/shared/ui/section-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useConnectionStore, type AuthMethod } from "@/entities/connection";
import { isValidPort } from "@/shared/lib/constants";
import { useConnectDialogStore } from "../model/connectStore";
import { useConnect } from "../model/useConnect";
import { useConnectionValidation } from "../model/useConnectionValidation";
import { sshTestConnection, classifySshError } from "../adapters/api/sshApi";
import { PasswordInput } from "./PasswordInput";

type TestStatus = "idle" | "testing" | "success" | "failed";

interface AuthMethodFieldsProps {
  authMethod: AuthMethod;
  onAuthMethodChange: (v: AuthMethod) => void;
  password: string;
  onPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  keyPath: string;
  onKeyPathChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  passphrase: string;
  onPassphraseChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  idPrefix: string;
}

function AuthMethodFields({
  authMethod,
  onAuthMethodChange,
  password,
  onPasswordChange,
  keyPath,
  onKeyPathChange,
  passphrase,
  onPassphraseChange,
  idPrefix,
}: AuthMethodFieldsProps) {
  return (
    <>
      <FormField label="Authentication">
        <Select
          value={authMethod}
          onValueChange={(v) => onAuthMethodChange(v as AuthMethod)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="password">Password</SelectItem>
            <SelectItem value="private-key">Private Key</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      {authMethod === "password" ? (
        <FormField label="Password" htmlFor={`${idPrefix}Password`}>
          <PasswordInput
            id={`${idPrefix}Password`}
            value={password}
            onChange={onPasswordChange}
            className="font-mono"
          />
        </FormField>
      ) : (
        <>
          <FormField label="Key Path" htmlFor={`${idPrefix}KeyPath`}>
            <Input
              id={`${idPrefix}KeyPath`}
              value={keyPath}
              onChange={onKeyPathChange}
              placeholder="~/.ssh/id_ed25519"
              className="font-mono text-sm"
            />
          </FormField>
          <FormField label="Passphrase" htmlFor={`${idPrefix}Passphrase`}>
            <PasswordInput
              id={`${idPrefix}Passphrase`}
              value={passphrase}
              onChange={onPassphraseChange}
              placeholder="optional"
              className="font-mono"
            />
          </FormField>
        </>
      )}
    </>
  );
}

interface ConnectionConfigParams {
  name: string;
  host: string;
  port: string;
  username: string;
  authMethod: AuthMethod;
  password: string;
  keyPath: string;
  passphrase: string;
  startupCommand: string;
  filterAuth: boolean;
}

interface JumpHostConfigParams {
  showJumpHost: boolean;
  jumpHost: string;
  jumpPort: string;
  jumpUsername: string;
  jumpAuthMethod: AuthMethod;
  jumpPassword: string;
  jumpKeyPath: string;
  jumpPassphrase: string;
}

function buildConnectionConfig(
  params: ConnectionConfigParams,
  jump: JumpHostConfigParams,
) {
  const portNum = parseInt(params.port, 10);
  const filterAuth = params.filterAuth;

  const authField = (value: string | undefined, requiredFor: AuthMethod) =>
    filterAuth && params.authMethod !== requiredFor ? undefined : value;

  const base = {
    name: params.name,
    host: params.host,
    port: portNum,
    username: params.username,
    authMethod: params.authMethod,
    password: authField(params.password, "password"),
    keyPath: authField(params.keyPath, "private-key"),
    passphrase: authField(params.passphrase, "private-key"),
    startupCommand: params.startupCommand || undefined,
  };

  if (!jump.showJumpHost || !jump.jumpHost) {
    return base;
  }

  const jumpPortNum = parseInt(jump.jumpPort, 10);
  if (!isValidPort(jumpPortNum)) {
    return { ...base, jumpHost: undefined };
  }
  return {
    ...base,
    jumpHost: jump.jumpHost,
    jumpPort: jumpPortNum,
    jumpUsername: jump.jumpUsername || undefined,
    jumpAuthMethod: jump.jumpAuthMethod,
    jumpPassword:
      jump.jumpAuthMethod === "password" ? jump.jumpPassword : undefined,
    jumpKeyPath:
      jump.jumpAuthMethod === "private-key" ? jump.jumpKeyPath : undefined,
    jumpPassphrase:
      jump.jumpAuthMethod === "private-key" ? jump.jumpPassphrase : undefined,
  };
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
  const markTouched = (field: string) =>
    setTouched((p) => ({ ...p, [field]: true }));

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

  const jumpParams: JumpHostConfigParams = {
    showJumpHost,
    jumpHost,
    jumpPort,
    jumpUsername,
    jumpAuthMethod,
    jumpPassword,
    jumpKeyPath,
    jumpPassphrase,
  };

  const validateJumpPort = (): boolean => {
    if (!showJumpHost || !jumpHost) return true;
    if (!isValidPort(jumpPort)) {
      setError("Jump host port must be between 1 and 65535");
      return false;
    }
    return true;
  };

  const handleTest = async () => {
    if (!validateJumpPort()) return;
    setTestStatus("testing");
    setTestError("");
    try {
      const config = buildConnectionConfig(
        {
          name: name || "Test",
          host,
          port,
          username,
          authMethod,
          password,
          keyPath,
          passphrase,
          startupCommand,
          filterAuth: true,
        },
        jumpParams,
      );
      await sshTestConnection({ id: editingConnection?.id ?? "test", ...config });
      setTestStatus("success");
    } catch (err) {
      setTestStatus("failed");
      setTestError(classifySshError(err));
    }
  };

  const handleConnect = () => {
    if (!validateJumpPort()) return;
    connect(buildConnectionConfig(
      {
        name,
        host,
        port,
        username,
        authMethod,
        password,
        keyPath,
        passphrase,
        startupCommand,
        filterAuth: false,
      },
      jumpParams,
    ));
  };

  const handleSave = () => {
    if (!editingConnection) return;
    if (!validateJumpPort()) return;
    const config = buildConnectionConfig(
      {
        name,
        host,
        port,
        username,
        authMethod,
        password,
        keyPath,
        passphrase,
        startupCommand,
        filterAuth: true,
      },
      jumpParams,
    );
    // Explicitly set jump fields to undefined when jump host is hidden (for clearing saved values)
    const saveData = showJumpHost
      ? config
      : {
          ...config,
          jumpHost: undefined,
          jumpPort: undefined,
          jumpUsername: undefined,
          jumpAuthMethod: undefined,
          jumpPassword: undefined,
          jumpKeyPath: undefined,
          jumpPassphrase: undefined,
        };
    updateConnection(editingConnection.id, saveData);
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
      <DialogContent className="flex max-h-[88%] flex-col sm:max-w-md">
        {/* Header */}
        <DialogHeader className="shrink-0 border-b border-border pb-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary/10">
              <Terminal className="size-4 text-primary" />
            </div>
            {isEditing ? "Edit Connection" : "New Connection"}
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable form */}
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-1 py-4 [touch-action:pan-y] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="space-y-5">

            {/* ── CONNECTION ── */}
            <SectionHeader title="Connection" />
            <div className="space-y-3">
              <FormField label="Name" htmlFor="name" error={errors.name ?? ""}>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => markTouched("name")}
                  placeholder="production-api"
                />
              </FormField>
              <div className="grid grid-cols-[1fr_5.5rem] gap-2.5">
                <FormField label="Host" htmlFor="host" error={errors.host ?? ""}>
                  <Input
                    id="host"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    onBlur={() => markTouched("host")}
                    placeholder="example.com"
                    className="font-mono"
                  />
                </FormField>
                <FormField label="Port" htmlFor="port" error={errors.port ?? ""}>
                  <Input
                    id="port"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    onBlur={() => markTouched("port")}
                    className="font-mono text-center"
                  />
                </FormField>
              </div>
              <FormField label="Username" htmlFor="username" error={errors.username ?? ""}>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onBlur={() => markTouched("username")}
                  className="font-mono"
                />
              </FormField>
            </div>

            {/* ── AUTHENTICATION ── */}
            <SectionHeader title="Authentication" />
            <div className="space-y-3">
              <AuthMethodFields
                authMethod={authMethod}
                onAuthMethodChange={setAuthMethod}
                password={password}
                onPasswordChange={(e) => setPassword(e.target.value)}
                keyPath={keyPath}
                onKeyPathChange={(e) => setKeyPath(e.target.value)}
                passphrase={passphrase}
                onPassphraseChange={(e) => setPassphrase(e.target.value)}
                idPrefix=""
              />
            </div>

            {/* ── ADVANCED ── */}
            <SectionHeader title="Advanced" />
            <div className="space-y-3">
              <FormField label="Startup Command" htmlFor="startupCommand">
                <Input
                  id="startupCommand"
                  value={startupCommand}
                  onChange={(e) => setStartupCommand(e.target.value)}
                  placeholder="tmux new -As main"
                  className="font-mono text-sm"
                />
              </FormField>

              {/* Jump Host toggle */}
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md px-1 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setShowJumpHost((p) => !p)}
              >
                {showJumpHost ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
                <span>jump_host</span>
                {showJumpHost && (
                  <span className="ml-1 rounded bg-primary/10 px-1 py-px text-[10px] text-primary">
                    enabled
                  </span>
                )}
              </button>

              {showJumpHost && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/30 px-3 py-3">
                  <div className="grid grid-cols-[1fr_5.5rem] gap-2.5">
                    <FormField label="Host" htmlFor="jumpHost">
                      <Input
                        id="jumpHost"
                        value={jumpHost}
                        onChange={(e) => setJumpHost(e.target.value)}
                        placeholder="bastion.example.com"
                        className="font-mono"
                      />
                    </FormField>
                    <FormField label="Port" htmlFor="jumpPort">
                      <Input
                        id="jumpPort"
                        value={jumpPort}
                        onChange={(e) => setJumpPort(e.target.value)}
                        className="font-mono text-center"
                      />
                    </FormField>
                  </div>
                  <FormField label="Username" htmlFor="jumpUsername">
                    <Input
                      id="jumpUsername"
                      value={jumpUsername}
                      onChange={(e) => setJumpUsername(e.target.value)}
                      className="font-mono"
                    />
                  </FormField>
                  <AuthMethodFields
                    authMethod={jumpAuthMethod}
                    onAuthMethodChange={setJumpAuthMethod}
                    password={jumpPassword}
                    onPasswordChange={(e) => setJumpPassword(e.target.value)}
                    keyPath={jumpKeyPath}
                    onKeyPathChange={(e) => setJumpKeyPath(e.target.value)}
                    passphrase={jumpPassphrase}
                    onPassphraseChange={(e) => setJumpPassphrase(e.target.value)}
                    idPrefix="jump"
                  />
                </div>
              )}
            </div>

            {/* Alerts */}
            {(error || testError) && (
              <InlineAlert variant="error" message={error || testError} />
            )}
            {testStatus === "success" && (
              <InlineAlert
                variant="success"
                message="Connection successful"
                icon={<CheckCircle2 className="size-4" />}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-border pt-3">
          {/* Test button — left side */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTest}
            disabled={testStatus === "testing" || !host || !username}
            className={`gap-1.5 font-mono text-xs ${
              testStatus === "success"
                ? "text-primary"
                : testStatus === "failed"
                  ? "text-destructive"
                  : "text-muted-foreground"
            }`}
          >
            {testStatus === "testing" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : testStatus === "success" ? (
              <CheckCircle2 className="size-3.5" />
            ) : testStatus === "failed" ? (
              <XCircle className="size-3.5" />
            ) : (
              <FlaskConical className="size-3.5" />
            )}
            {testStatus === "testing" ? "testing..." : "test_conn"}
          </Button>

          {/* Cancel + Save/Connect — right side */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            {isEditing ? (
              <Button size="sm" onClick={handleSave} disabled={!isValid}>
                Save
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleConnect}
                disabled={connecting || !isValid}
              >
                {connecting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Connecting…
                  </>
                ) : (
                  "Connect"
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
