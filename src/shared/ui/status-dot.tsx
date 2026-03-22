import { statusColor } from "@/shared/lib/statusColor";
import type { SessionStatus } from "@/shared/lib/types";

interface StatusDotProps {
  status: SessionStatus;
  className?: string;
}

export function StatusDot({ status, className }: StatusDotProps) {
  return (
    <span
      className={`inline-block size-1.5 shrink-0 rounded-full ${statusColor(status)} ${className ?? ""}`}
    />
  );
}
