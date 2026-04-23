import { useEffect, useRef } from "react";
import { ShieldAlert, ShieldQuestion } from "lucide-react";
import { CodeBlock } from "@/shared/ui/code-block";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { useHostKeyVerifyStore } from "../model/hostKeyVerifyStore";
import { subscribeSshHostKeyVerify } from "../adapters/events/sshEventAdapter";
import { sshHostKeyVerifyRespond } from "../adapters/api/sshApi";

export function HostKeyVerifyDialog() {
  const request = useHostKeyVerifyStore((s) => s.request);
  const setRequest = useHostKeyVerifyStore((s) => s.setRequest);
  const respondingRef = useRef(false);

  useEffect(() => {
    const unlisten = subscribeSshHostKeyVerify((payload) => {
      respondingRef.current = false;
      setRequest(payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setRequest]);

  const respond = async (accepted: boolean) => {
    if (!request || respondingRef.current) return;
    respondingRef.current = true;
    await sshHostKeyVerifyRespond(request.sessionId, accepted).catch(
      console.error,
    );
    setRequest(null);
  };

  const isChanged = request?.status === "changed";

  return (
    <Dialog open={!!request} onOpenChange={() => respond(false)}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isChanged ? (
              <>
                <ShieldAlert className="size-5 text-destructive" />
                Server Key Changed
              </>
            ) : (
              <>
                <ShieldQuestion className="size-5 text-warning" />
                Unknown Server
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isChanged
              ? "The server's host key has changed. This could indicate a security threat (MITM attack) or a legitimate server reconfiguration."
              : "This is the first time connecting to this server. Please verify the fingerprint before proceeding."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {isChanged && request.oldFingerprint && (
            <CodeBlock label="Previous fingerprint">
              {request.oldFingerprint}
            </CodeBlock>
          )}
          <CodeBlock label={isChanged ? "New fingerprint" : "Fingerprint"}>
            {request?.fingerprint}
          </CodeBlock>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => respond(false)}>
            Reject
          </Button>
          <Button
            variant={isChanged ? "destructive" : "default"}
            onClick={() => respond(true)}
          >
            {isChanged ? "Accept Anyway" : "Accept"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
