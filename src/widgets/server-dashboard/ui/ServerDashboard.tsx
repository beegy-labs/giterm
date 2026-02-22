import { Cpu, HardDrive, MemoryStick } from "lucide-react";
import type { ServerStats } from "@/features/server-monitor";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function StatBar({
  label,
  percent,
  detail,
  icon: Icon,
}: {
  label: string;
  percent: number;
  detail: string;
  icon: typeof Cpu;
}) {
  const color =
    percent > 90
      ? "bg-red-500"
      : percent > 70
        ? "bg-yellow-500"
        : "bg-green-500";

  return (
    <div className="flex items-center gap-2">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">{label}</span>
          <span className="text-foreground">{percent}%</span>
        </div>
        <div className="mt-0.5 h-1.5 rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${color}`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
        <div className="mt-0.5 text-[9px] text-muted-foreground">{detail}</div>
      </div>
    </div>
  );
}

interface ServerDashboardProps {
  stats: ServerStats | null;
}

export function ServerDashboard({ stats }: ServerDashboardProps) {
  if (!stats) return null;

  return (
    <div className="flex flex-col gap-2 border-t border-border px-3 py-2">
      <StatBar
        label="CPU"
        percent={stats.cpuPercent}
        detail=""
        icon={Cpu}
      />
      <StatBar
        label="RAM"
        percent={stats.memPercent}
        detail={`${formatBytes(stats.memUsed)} / ${formatBytes(stats.memTotal)}`}
        icon={MemoryStick}
      />
      <StatBar
        label="Disk"
        percent={stats.diskPercent}
        detail={`${formatBytes(stats.diskUsed)} / ${formatBytes(stats.diskTotal)}`}
        icon={HardDrive}
      />
    </div>
  );
}
