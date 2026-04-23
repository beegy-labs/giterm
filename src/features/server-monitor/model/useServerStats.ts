import { queryOptions, useQuery } from "@tanstack/react-query";
import { sshExec } from "@/shared/adapters/sshExecApi";
import { STALE_TIME_FAST, REFETCH_INTERVAL_FAST } from "@/shared/lib/constants";
import {
  parseServerStats,
  STATS_COMMAND,
  type ServerStats,
} from "./parseServerStats";

export type { ServerStats };

async function fetchServerStats(sessionId: string): Promise<ServerStats> {
  const output = await sshExec(sessionId, STATS_COMMAND);
  return parseServerStats(sessionId, output);
}

export const serverStatsQuery = (sessionId: string) =>
  queryOptions({
    queryKey: ["serverStats", sessionId],
    queryFn: () => fetchServerStats(sessionId),
    staleTime: STALE_TIME_FAST,
    refetchInterval: REFETCH_INTERVAL_FAST,
    // Stop polling when the app is backgrounded — saves battery on iOS
    refetchIntervalInBackground: false,
    retry: false,
    enabled: !!sessionId,
  });

export function useServerStats(sessionId: string | undefined) {
  const { data: stats = null, error } = useQuery(
    sessionId
      ? serverStatsQuery(sessionId)
      : { queryKey: ["serverStats", ""], enabled: false },
  );

  return { stats, error: error ? String(error) : null };
}
