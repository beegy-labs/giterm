import { useState, useEffect } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
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
            />
          </FormField>
          <FormField label="Passphrase" htmlFor={`${idPrefix}Passphrase`}>
            <PasswordInput
              id={`${idPrefix}Passphrase`}
              value={passphrase}
              onChange={onPassphraseChange}
              placeholder="Optional"
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
      <DialogContent className="flex max-h-[85%] flex-col sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {isEditing ? "Edit Connection" : "New Connection"}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-1 py-4 [touch-action:pan-y] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="space-y-4">
            <FormField label="Name" htmlFor="name" error={errors.name ?? ""}>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => markTouched("name")}
                placeholder="My Server"
              />
            </FormField>
            {/* Host + Port on same row */}
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <FormField label="Host" htmlFor="host" error={errors.host ?? ""}>
                <Input
                  id="host"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  onBlur={() => markTouched("host")}
                  placeholder="example.com"
                />
              </FormField>
              <FormField label="Port" htmlFor="port" error={errors.port ?? ""}>
                <Input
                  id="port"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  onBlur={() => markTouched("port")}
                />
              </FormField>
            </div>
            <FormField label="Username" htmlFor="username" error={errors.username ?? ""}>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onBlur={() => markTouched("username")}
              />
            </FormField>
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
            <FormField label="Startup Command" htmlFor="startupCommand">
              <Input
                id="startupCommand"
                value={startupCommand}
                onChange={(e) => setStartupCommand(e.target.value)}
                placeholder="e.g. cd /app && ls"
              />
            </FormField>

            {/* Jump Host Section */}
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowJumpHost((p) => !p)}
            >
              {showJumpHost ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
              Jump Host
            </button>
            {showJumpHost && (
              <div className="space-y-4 rounded-lg border border-border bg-card/50 p-4">
                <div className="grid grid-cols-[1fr_6rem] gap-3">
                  <FormField label="Host" htmlFor="jumpHost">
                    <Input
                      id="jumpHost"
                      value={jumpHost}
                      onChange={(e) => setJumpHost(e.target.value)}
                      placeholder="jump.example.com"
                    />
                  </FormField>
                  <FormField label="Port" htmlFor="jumpPort">
                    <Input
                      id="jumpPort"
                      value={jumpPort}
                      onChange={(e) => setJumpPort(e.target.value)}
                    />
                  </FormField>
                </div>
                <FormField label="Username" htmlFor="jumpUsername">
                  <Input
                    id="jumpUsername"
                    value={jumpUsername}
                    onChange={(e) => setJumpUsername(e.target.value)}
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
