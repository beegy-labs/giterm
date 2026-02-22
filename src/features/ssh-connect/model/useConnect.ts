import { useState } from "react";
import {
  connectFromConfig,
  classifySshError,
} from "@/features/ssh-connect/adapters/api/sshApi";
import { useConnectionStore, type AuthMethod } from "@/entities/connection";
import { useSessionStore } from "@/entities/session";
import { useConnectDialogStore } from "./connectStore";

interface ConnectParams {
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
  password: string;
  keyPath: string;
  passphrase: string;
  startupCommand?: string;
  jumpHost?: string;
  jumpPort?: number;
  jumpUsername?: string;
  jumpAuthMethod?: AuthMethod;
  jumpPassword?: string;
  jumpKeyPath?: string;
  jumpPassphrase?: string;
}

export function useConnect() {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const addConnection = useConnectionStore((s) => s.addConnection);
  const addSession = useSessionStore((s) => s.addSession);
  const setOpen = useConnectDialogStore((s) => s.setOpen);

  const connect = async (params: ConnectParams) => {
    setConnecting(true);
    setError("");

    const connectionId = crypto.randomUUID();
    const placeholderId = `connecting-${connectionId}`;

    try {
      const connectionConfig = {
        id: connectionId,
        name: params.name || "Server",
        host: params.host,
        port: params.port,
        username: params.username,
        authMethod: params.authMethod,
        password: params.authMethod === "password" ? params.password : undefined,
        keyPath:
          params.authMethod === "private-key" ? params.keyPath : undefined,
        passphrase:
          params.authMethod === "private-key" ? params.passphrase : undefined,
        startupCommand: params.startupCommand || undefined,
        jumpHost: params.jumpHost || undefined,
        jumpPort: params.jumpPort,
        jumpUsername: params.jumpUsername || undefined,
        jumpAuthMethod: params.jumpAuthMethod,
        jumpPassword: params.jumpPassword || undefined,
        jumpKeyPath: params.jumpKeyPath || undefined,
        jumpPassphrase: params.jumpPassphrase || undefined,
      };

      addSession({
        sessionId: placeholderId,
        connectionId,
        connectionName: connectionConfig.name,
        status: "connecting",
      });

      const sessionId = await connectFromConfig(connectionConfig);

      addConnection(connectionConfig);

      useSessionStore.getState().updateSession(placeholderId, {
        sessionId,
        status: "connected",
      });

      setOpen(false);
    } catch (err) {
      useSessionStore.getState().updateSession(placeholderId, {
        status: "error",
        error: classifySshError(err),
      });
      setError(classifySshError(err));
    } finally {
      setConnecting(false);
    }
  };

  return { connect, connecting, error, setError };
}
