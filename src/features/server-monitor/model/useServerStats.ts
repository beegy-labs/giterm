import { useState, useEffect, useRef, useCallback } from "react";
import { sshExec } from "@/features/ssh-connect";

export interface ServerStats {
  cpuPercent: number;
  memUsed: number;
  memTotal: number;
  memPercent: number;
  diskUsed: number;
  diskTotal: number;
  diskPercent: number;
}

const POLL_INTERVAL_MS = 5000;

function parseCpuPercent(output: string): number {
  // Parses /proc/stat: cpu user nice system idle ...
  const lines = output.trim().split("\n");
  const cpuLine = lines.find((l) => l.startsWith("cpu "));
  if (!cpuLine) return 0;
  const parts = cpuLine.split(/\s+/).slice(1).map(Number);
  const idle = parts[3] ?? 0;
  const total = parts.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  return Math.round(((total - idle) / total) * 100);
}

function parseMem(output: string): { used: number; total: number } {
  // Parses `free -b`
  const lines = output.trim().split("\n");
  const memLine = lines.find((l) => l.startsWith("Mem:"));
  if (!memLine) return { used: 0, total: 0 };
  const parts = memLine.split(/\s+/);
  return { total: Number(parts[1]) || 0, used: Number(parts[2]) || 0 };
}

function parseDisk(output: string): { used: number; total: number } {
  // Parses `df -B1 /`
  const lines = output.trim().split("\n");
  if (lines.length < 2) return { used: 0, total: 0 };
  const parts = (lines[1] ?? "").split(/\s+/);
  return { total: Number(parts[1]) || 0, used: Number(parts[2]) || 0 };
}

export function useServerStats(sessionId: string | undefined) {
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    if (!sessionId) return;
    try {
      const [cpuOut, memOut, diskOut] = await Promise.all([
        sshExec(sessionId, "cat /proc/stat | head -1"),
        sshExec(sessionId, "free -b"),
        sshExec(sessionId, "df -B1 /"),
      ]);

      const cpu = parseCpuPercent(cpuOut);
      const mem = parseMem(memOut);
      const disk = parseDisk(diskOut);

      setStats({
        cpuPercent: cpu,
        memUsed: mem.used,
        memTotal: mem.total,
        memPercent: mem.total ? Math.round((mem.used / mem.total) * 100) : 0,
        diskUsed: disk.used,
        diskTotal: disk.total,
        diskPercent: disk.total
          ? Math.round((disk.used / disk.total) * 100)
          : 0,
      });
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setStats(null);
      return;
    }

    fetchStats();
    timerRef.current = setInterval(fetchStats, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionId, fetchStats]);

  return { stats, error };
}
