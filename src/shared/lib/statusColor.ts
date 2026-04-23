import type { SessionStatus } from "@/shared/lib/types";

const STATUS_COLORS: Record<SessionStatus, string> = {
  connected: "bg-primary",
  connecting: "bg-amber-500",
  reconnecting: "bg-amber-500",
  disconnected: "bg-destructive",
  error: "bg-destructive",
};

export function statusColor(status: SessionStatus): string {
  return STATUS_COLORS[status];
}
