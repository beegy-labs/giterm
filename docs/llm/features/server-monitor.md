# Server Monitor — Feature SSOT

> Real-time server stats via SSH exec | **Last Updated**: 2026-03-06

## Structure

```
features/server-monitor/
├── model/parseServerStats.ts — CPU/mem/disk parsing + STATS_COMMAND
├── model/useServerStats.ts   — TanStack Query factory + hook
└── index.ts
```

## Architecture

- **Query factory**: `features/server-monitor/model/useServerStats.ts` uses `queryOptions()`
- **Parsing**: `parseServerStats()` in same feature, CPU delta via `shared/lib/cpuSnapshotCache.ts`
- **Data source**: `sshExec(sessionId, command)` runs shell commands on remote
- **Polling**: `refetchInterval: 5000ms`, `staleTime: 4000ms`
- **Lifecycle**: `enabled: !!sessionId` — auto-disables when session closes

## Stats Collected

Single SSH exec call parses: CPU usage, memory, disk.

## Key Decision

- TanStack Query (not Zustand) — automatic cache, dedup, background refetch
- `queryOptions()` factory in feature layer (not shared) per FSD dependency rule
- CPU snapshot cache in `shared/lib/` — used by both server-monitor and closeSession
