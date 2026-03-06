import type { SessionStatus } from "@/shared/lib/types";

const STATUS_COLORS: Record<SessionStatus, string> = {
  connected: "bg-green-500",
  connecting: "bg-yellow-500",
  reconnecting: "bg-yellow-500",
  disconnected: "bg-red-500",
  error: "bg-red-500",
};

export function statusColor(status: SessionStatus): string {
  return STATUS_COLORS[status];
}
