/**
 * CPU snapshot cache for server stats delta calculation.
 * Shared so that both server-monitor (writes) and ssh-connect/closeSession
 * (clears on disconnect) can access it without cross-feature imports.
 */

interface CpuSnapshot {
  idle: number;
  total: number;
}

const prevCpuSnapshots = new Map<string, CpuSnapshot>();

export function clearCpuSnapshot(sessionId: string): void {
  prevCpuSnapshots.delete(sessionId);
}

export function getCpuSnapshot(sessionId: string): CpuSnapshot | undefined {
  return prevCpuSnapshots.get(sessionId);
}

export function setCpuSnapshot(sessionId: string, snapshot: CpuSnapshot): void {
  prevCpuSnapshots.set(sessionId, snapshot);
}
