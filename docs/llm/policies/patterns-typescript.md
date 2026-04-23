# Patterns: TypeScript 6 Strict

> SSOT | **Last Updated**: 2026-03-24

## Discriminated Unions over `any`

```typescript
type BannerType = 'admob' | 'coupang' | 'none'
type TestStatus = 'idle' | 'testing' | 'success' | 'failed'
```

## `satisfies` for Config Objects

```typescript
const QUERY_CONFIG = {
  serverStats: { staleTime: 4_000, refetchInterval: 5_000 },
} satisfies Record<string, { staleTime: number; refetchInterval: number }>
```

## `unknown` at Boundaries — Explicit Annotation

```typescript
// CORRECT — always annotate catch explicitly
try {
  await admobBannerShow(...)
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  console.warn('[AdMob] show failed:', msg)
}
```

## Named Constants (no magic values)

```typescript
// src/shared/lib/constants.ts — SSOT
export const STALE_TIME_FAST = 4_000
export const REFETCH_INTERVAL_FAST = 5_000
export const SSH_CONNECT_TIMEOUT_MS = 15_000
export const BACKGROUND_COOLDOWN_MS = 60 * 60 * 1_000
export const MAX_CONNECTIONS = 5
export const MAX_SESSIONS = 5
export const MAX_TUNNELS = 20
```

## tsconfig (ES2025, bundler)

```json
{
  "lib": ["ES2025", "DOM", "DOM.Iterable"],
  "module": "ESNext",
  "moduleResolution": "bundler",
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noUncheckedIndexedAccess": true
}
```
