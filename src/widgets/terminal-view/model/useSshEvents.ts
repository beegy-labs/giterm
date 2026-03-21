import { useEffect, type MutableRefObject } from "react";
import { subscribeSshData, subscribeSshDisconnect } from "@/features/ssh-connect";
import { useSessionStore } from "@/entities/session";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type { TermInstance } from "./types";

export function useSshEvents(
  instancesRef: MutableRefObject<Map<string, TermInstance>>,
): void {
  useEffect(() => {
    let cancelled = false;
    let unlistenData: UnlistenFn | null = null;
    let unlistenDisconnect: UnlistenFn | null = null;

    const setup = async () => {
      const ulData = await subscribeSshData((sessionId, data) => {
        const inst = instancesRef.current.get(sessionId);
        if (inst) {
          inst.terminal.write(data);
        }
      });
      if (cancelled) {
        ulData();
        return;
      }
      unlistenData = ulData;

      let ulDisconnect: UnlistenFn;
      try {
        ulDisconnect = await subscribeSshDisconnect((sessionId) => {
          const inst = instancesRef.current.get(sessionId);
          if (inst) {
            inst.terminal.write("\r\n\x1b[31m[Disconnected]\x1b[0m\r\n");
          }
          useSessionStore
            .getState()
            .updateSession(sessionId, { status: "disconnected" });
        });
      } catch (err) {
        ulData();
        unlistenData = null;
        throw err;
      }
      if (cancelled) {
        ulData();
        unlistenData = null;
        ulDisconnect();
        return;
      }
      unlistenDisconnect = ulDisconnect;
    };

    setup();

    return () => {
      cancelled = true;
      unlistenData?.();
      unlistenDisconnect?.();
    };
  }, [instancesRef]);
}
