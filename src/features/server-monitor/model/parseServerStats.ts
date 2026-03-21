import {
  getCpuSnapshot,
  setCpuSnapshot,
} from "@/shared/lib/cpuSnapshotCache";

export interface ServerStats {
  cpuPercent: number;
  memUsed: number;
  memTotal: number;
  memPercent: number;
  diskUsed: number;
  diskTotal: number;
  diskPercent: number;
}

function parseCpuLine(line: string): { idle: number; total: number } | null {
  if (!line.startsWith("cpu ")) return null;
  const parts = line.split(/\s+/).slice(1).map(Number);
  const idle = parts[3] ?? 0;
  const total = parts.reduce((a, b) => a + b, 0);
  return { idle, total };
}

function calcCpuPercent(sessionId: string, cpuLine: string): number {
  const current = parseCpuLine(cpuLine);
  if (!current || current.total === 0) return 0;

  const prev = getCpuSnapshot(sessionId);
  setCpuSnapshot(sessionId, current);

  if (!prev) {
    const busy = current.total - current.idle;
    return current.total ? Math.round((busy / current.total) * 100) : 0;
  }

  const dTotal = current.total - prev.total;
  const dIdle = current.idle - prev.idle;
  if (dTotal === 0) return 0;
  return Math.round(((dTotal - dIdle) / dTotal) * 100);
}

function parseMem(memSection: string): { used: number; total: number } {
  const memLine = memSection
    .split("\n")
    .find((l) => l.startsWith("Mem:"));
  if (!memLine) return { used: 0, total: 0 };
  const parts = memLine.split(/\s+/);
  return { total: Number(parts[1] ?? 0), used: Number(parts[2] ?? 0) };
}

function parseDisk(diskSection: string): { used: number; total: number } {
  const lines = diskSection.trim().split("\n");
  if (lines.length < 2) return { used: 0, total: 0 };
  const parts = (lines[1] ?? "").split(/\s+/);
  return { total: Number(parts[1] ?? 0), used: Number(parts[2] ?? 0) };
}

export const STATS_COMMAND = "head -1 /proc/stat && free -b && df -B1 /";

export function parseServerStats(
  sessionId: string,
  output: string,
): ServerStats {
  const lines = output.split("\n");
  const cpuLine = lines[0] ?? "";

  const freeStartIdx = lines.findIndex(
    (l) => l.trim().startsWith("total") || l.trim().startsWith("Mem:"),
  );
  const dfStartIdx = lines.findIndex((l) => l.startsWith("Filesystem"));

  const memSection =
    freeStartIdx >= 0 && dfStartIdx >= 0
      ? lines.slice(freeStartIdx, dfStartIdx).join("\n")
      : freeStartIdx >= 0
        ? lines.slice(freeStartIdx).join("\n")
        : "";

  const diskSection =
    dfStartIdx >= 0 ? lines.slice(dfStartIdx).join("\n") : "";

  const cpu = calcCpuPercent(sessionId, cpuLine);
  const mem = parseMem(memSection);
  const disk = parseDisk(diskSection);

  return {
    cpuPercent: cpu,
    memUsed: mem.used,
    memTotal: mem.total,
    memPercent: mem.total ? Math.round((mem.used / mem.total) * 100) : 0,
    diskUsed: disk.used,
    diskTotal: disk.total,
    diskPercent: disk.total ? Math.round((disk.used / disk.total) * 100) : 0,
  };
}
