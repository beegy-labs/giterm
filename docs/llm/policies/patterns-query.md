# Patterns: TanStack Query v5

> SSOT | **Last Updated**: 2026-03-24

## `queryOptions()` Factory — SSOT

Define query config once, reuse across components and prefetch:

```typescript
// src/shared/queries/serverStats.ts
import { queryOptions } from '@tanstack/react-query'
import { STALE_TIME_FAST, REFETCH_INTERVAL_FAST } from '@/shared/lib/constants'

export const serverStatsQuery = (sessionId: string) => queryOptions({
  queryKey: ['server-stats', sessionId],
  queryFn: () => fetchServerStats(sessionId),
  staleTime: STALE_TIME_FAST,
  refetchInterval: REFETCH_INTERVAL_FAST,
  refetchIntervalInBackground: false, // battery: stop polling when backgrounded
  enabled: !!sessionId,
})
```

## Timing Constants

All `staleTime` / `refetchInterval` from `shared/lib/constants.ts` — never hardcode:

```typescript
export const STALE_TIME_FAST = 4_000       // 4s — server stats
export const REFETCH_INTERVAL_FAST = 5_000 // 5s — server stats
```

Static data: `staleTime: Infinity` (connection config, user prefs).

## Mutation — `onSettled` (not `onSuccess`)

```typescript
// CORRECT — onSettled runs on both success and error
const mutation = useMutation({
  mutationFn: (id: string) => deleteConnection(id),
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['connections'] }),
  onError: (e: Error) => setError(e.message),
})
```

## `useSuspenseQuery` (React 19 + Suspense)

```typescript
function ServerStats({ sessionId }: { sessionId: string }) {
  const { data } = useSuspenseQuery(serverStatsQuery(sessionId))
  return <StatPanel stats={data} />
}

// Parent
<Suspense fallback={<StatSkeleton />}>
  <ServerStats sessionId={sessionId} />
</Suspense>
```

Use `useQuery` when you need `isLoading` / `isError` branching in the same component.

## Inline Query (modal / one-off)

```typescript
const { data } = useQuery({
  queryKey: ['server-detail', sessionId],
  queryFn: () => fetchServerDetail(sessionId),
  enabled: !!sessionId && isOpen,
})
```
