import { WifiOff } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";

interface DisconnectDialogProps {
  open: boolean;
  connectionName: string;
  onReconnect: () => void;
  onClose: () => void;
}

export function DisconnectDialog({
  open,
  connectionName,
  onReconnect,
  onClose,
}: DisconnectDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <WifiOff className="size-5 text-destructive" />
            Connection Lost
          </AlertDialogTitle>
          <AlertDialogDescription>
            The connection to {connectionName || "the server"} was lost
            unexpectedly.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close Session
          </Button>
          <Button onClick={onReconnect}>Reconnect</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
