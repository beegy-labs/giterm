# Code Patterns: giterm — 2026 Reference

> SSOT | **Last Updated**: 2026-03-24 | Classification: Operational
> React 19 · TypeScript 5.9 · Zustand 5 · TanStack Query v5 · Tailwind v4 · Tauri v2 · Rust Edition 2021

---

## TanStack Query v5

### `queryOptions()` Factory — SSOT Pattern

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
  enabled: !!sessionId,
})
```

Benefits: single place to change `staleTime`/`retry`, type-safe key sharing, reuse in `prefetchQuery`.

### Timing Constants

All `staleTime` and `refetchInterval` come from `shared/lib/constants.ts` — never hardcode:

```typescript
export const STALE_TIME_FAST = 4_000       // 4s — server stats
export const REFETCH_INTERVAL_FAST = 5_000 // 5s — server stats
```

### Mutation — `onSettled` for Cache Invalidation

```typescript
// CORRECT — onSettled runs on both success and error
const mutation = useMutation({
  mutationFn: (id: string) => deleteConnection(id),
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['connections'] }),
  onError: (e: Error) => setError(e.message),
})

// WRONG — onSuccess skips invalidation when the request errors
onSuccess: () => queryClient.invalidateQueries(...)
```

### Inline Query (modal/one-off)

```typescript
const { data } = useQuery({
  queryKey: ['server-detail', sessionId],
  queryFn: () => fetchServerDetail(sessionId),
  enabled: !!sessionId && isOpen,
})
```

---

## Zustand 5

### Selector Pattern — No Inline Arrow Functions

```typescript
// CORRECT — stable reference, no re-render on unrelated state change
const userId = useAdBannerStore((s) => s.userId)
const adsEnabled = useAdBannerStore((s) => s.adsEnabled)

// WRONG — inline selector creates new function every render (not a problem in Zustand 5
// but exporting named selectors is clearer and testable)
```

### External Selectors (SSOT)

```typescript
// src/entities/session/model/sessionStore.ts
export const selectActiveSession = (s: SessionState) =>
  s.sessions[s.activeIndex] ?? null

// Usage
const session = useSessionStore(selectActiveSession)
```

### `partialize` for Persistence

```typescript
// CORRECT — only persist non-sensitive fields
persist(
  (set) => ({ ... }),
  {
    name: 'giterm:connections',
    storage: tauriStorage,
    partialize: (state) => ({
      connections: state.connections.map(({ password, passphrase, ...safe }) => safe),
    }),
  }
)
```

Secrets go to OS keychain via `credentialApi`, not to persisted store.

### Direct State Access Outside React

```typescript
// Outside React (e.g. in adapters, event handlers)
const { userId, recordShown } = useAdBannerStore.getState()
useAdBannerStore.setState({ isBannerVisible: true })
```

---

## React 19

### `useOptimistic` for Instant Feedback

Apply to toggle/switch mutations:

```typescript
import { useOptimistic } from 'react'

const [optimisticEnabled, setOptimistic] = useOptimistic(
  adsEnabled,
  (_, newValue: boolean) => newValue,
)

const mutation = useMutation({
  mutationFn: (v: boolean) => setAdsEnabled(v),
  onError: () => setOptimistic(adsEnabled), // revert on error
})

<Switch
  checked={optimisticEnabled}
  onCheckedChange={(v) => { setOptimistic(v); mutation.mutate(v) }}
/>
```

### `useTransition` for Non-Urgent Updates

```typescript
const [isPending, startTransition] = useTransition()

const handleTabSwitch = (index: number) => {
  startTransition(() => setActiveIndex(index))
}
```

### `ref` as Prop (React 19 — No `forwardRef`)

```typescript
// React 19: ref passed as a regular prop, no forwardRef needed
function Input({ ref, ...props }: React.ComponentProps<'input'>) {
  return <input ref={ref} {...props} />
}
```

### Avoid Unnecessary Memo

React 19 compiler handles many cases. Apply `useMemo` only for:
- Expensive filter/sort/map chains on large datasets
- Values used as `useEffect` deps that would otherwise cause loops

```typescript
// Needed — filters + sorts query data
const sortedConnections = useMemo(
  () => connections.slice().sort((a, b) => a.name.localeCompare(b.name)),
  [connections],
)

// Not needed — simple property access
const name = connection.name // no memo
```

---

## TypeScript Strict Patterns

### Discriminated Unions over `any`

```typescript
// CORRECT
type BannerType = 'admob' | 'coupang' | 'none'
type TestStatus = 'idle' | 'testing' | 'success' | 'failed'

// WRONG
let status: any = 'idle'
```

### `satisfies` for Config Objects

```typescript
const QUERY_CONFIG = {
  serverStats: { staleTime: 4_000, refetchInterval: 5_000 },
} satisfies Record<string, { staleTime: number; refetchInterval: number }>
```

### `unknown` at Boundaries (Tauri IPC errors)

```typescript
try {
  await admobBannerShow(...)
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  console.warn('[AdMob] show failed:', msg)
}
```

### Named Constants over Magic Values

```typescript
// src/shared/lib/constants.ts — SSOT for all magic values
export const SSH_CONNECT_TIMEOUT_MS = 15_000
export const BACKGROUND_COOLDOWN_MS = 60 * 60 * 1_000  // 1 hour
export const MAX_CONNECTIONS = 20
export const MAX_SESSIONS = 5
export const MAX_TUNNELS = 20
```

---

## Tauri v2 IPC Patterns

### Adapter Wrapper (Never Invoke from UI)

```typescript
// src/features/ssh-connect/adapters/api/sshApi.ts
import { invoke } from '@tauri-apps/api/core'

export function sshConnect(config: ConnectionConfig): Promise<string> {
  return invoke('ssh_connect', { config })
}

// UI component calls the adapter, never invoke() directly
const sessionId = await sshConnect(config)
```

### Event Adapter (Never listen() from UI)

```typescript
// src/features/ssh-connect/adapters/events/sshEvents.ts
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

export function subscribeSshData(
  sessionId: string,
  onData: (data: string) => void,
): Promise<UnlistenFn> {
  return listen<string>(`ssh-data-${sessionId}`, (e) => onData(e.payload))
}
```

### StrictMode Double-Subscribe Guard

```typescript
useEffect(() => {
  let cancelled = false
  let unlisten: UnlistenFn | null = null

  subscribeSshData(sessionId, (data) => {
    if (!cancelled) onData(data)
  }).then((fn) => { if (!cancelled) unlisten = fn })

  return () => {
    cancelled = true
    unlisten?.()
  }
}, [sessionId])
```

---

## Tailwind CSS v4

### CSS Variable Tokens (No `tailwind.config.js`)

Config lives in CSS, not JS:

```css
/* src/index.css */
@theme {
  --color-primary: #10B981;
  --color-background: #0B0E0C;
}
```

### Semantic Utility Classes

```tsx
// CORRECT — uses theme token
<div className="bg-primary text-primary-foreground" />

// WRONG — bypasses theme
<div style={{ backgroundColor: '#10B981' }} />
<div className="bg-emerald-500" />  // hardcoded Tailwind color
```

### `overlay-fullscreen` — Full-Screen Fixed Overlay

```tsx
// For dialogs, overlays, backdrops — uses --app-h (never shrinks with keyboard)
<div className="overlay-fullscreen z-50 bg-black/50" />

// Dialog centering wrapper — uses --vvh (re-centers when keyboard appears)
<div
  className="overlay-fullscreen z-50 flex items-center justify-center"
  style={{ height: 'var(--vvh, var(--app-h, 100vh))' }}
/>
```

### Mobile Safe Area

```tsx
// CORRECT — pt-safe-bar on individual headers only
<header className="pt-safe-bar">...</header>

// WRONG — never on layout containers (shrinks children's space)
<div className="overlay-fullscreen pt-safe-bar">...</div>
```

---

## Rust / Tauri Commands

### Command Pattern

```rust
// All commands: specta + tauri::command
#[tauri::command]
#[specta::specta]
pub async fn ssh_connect(
    state: tauri::State<'_, AppState>,
    config: ConnectionConfig,
) -> Result<String, String> {
    state.ssh_manager.connect(config).await.map_err(|e| e.to_string())
}
```

### Named Timeout Constants

```rust
// src-tauri/src/ssh/session.rs
const SSH_CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const SSH_CHANNEL_TIMEOUT: Duration = Duration::from_secs(30);

// Never: tokio::time::timeout(Duration::from_secs(10), ...)
tokio::time::timeout(SSH_CONNECT_TIMEOUT, connect()).await
```

### Error Types — `String` for IPC Boundary

Tauri commands return `Result<T, String>` — `String` serializes cleanly across IPC.
Internal Rust code uses `anyhow::Error`; convert at the command boundary:

```rust
pub async fn my_command(...) -> Result<Value, String> {
    internal_logic().await.map_err(|e| e.to_string())
}
```

### Secret Redaction in Debug

```rust
// types.rs — manual Debug impl to redact secrets
impl fmt::Debug for ConnectionConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ConnectionConfig")
            .field("host", &self.host)
            .field("password", &"[REDACTED]")
            .finish()
    }
}
```

---

## Adding a New Feature

| Step | File | Action |
|------|------|--------|
| 1 | `docs/llm/features/new-feature.md` | Write CDD doc first |
| 2 | `src/features/new-feature/model/newStore.ts` | Zustand store |
| 3 | `src/features/new-feature/adapters/api/newApi.ts` | IPC wrappers |
| 4 | `src/features/new-feature/adapters/events/newEvents.ts` | Event adapters (if needed) |
| 5 | `src/features/new-feature/ui/NewComponent.tsx` | UI (reads from model only) |
| 6 | `src/features/new-feature/index.ts` | Public exports |
| 7 | `src-tauri/src/commands/new.rs` | Rust commands (if needed) |
| 8 | `docs/llm/README.md` | Add to features table |
