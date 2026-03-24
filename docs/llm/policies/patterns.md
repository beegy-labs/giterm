# Code Patterns: giterm — 2026 Reference

> SSOT | **Last Updated**: 2026-03-24 | Classification: Operational
> React 19 · TypeScript 6 · Zustand 5 · TanStack Query v5 · Tailwind v4 · Tauri v2 · Rust Edition 2021

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

Static/immutable data (connection config, user settings):

```typescript
staleTime: Infinity,  // never re-fetch unless explicitly invalidated
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

### `useSuspenseQuery` (React 19 + Suspense)

Use when the component always needs data before rendering — wraps in `<Suspense>`:

```typescript
// CORRECT — throws Promise until data is ready, then renders
function ServerStats({ sessionId }: { sessionId: string }) {
  const { data } = useSuspenseQuery(serverStatsQuery(sessionId))
  return <StatPanel stats={data} />
}

// Parent
<Suspense fallback={<StatSkeleton />}>
  <ServerStats sessionId={sessionId} />
</Suspense>
```

`useQuery` is still appropriate when you need `isLoading` / `isError` branching in the same component.

---

## Zustand 5

### Selector Pattern — Single Values (No `useShallow` needed)

```typescript
// CORRECT — primitive selectors are always stable
const userId = useAdBannerStore((s) => s.userId)
const adsEnabled = useAdBannerStore((s) => s.adsEnabled)
```

### `useShallow` — Object / Array Selectors (REQUIRED in v5)

In Zustand 5, returning objects or arrays from a selector creates a new reference every render → infinite re-render loop. Use `useShallow`:

```typescript
import { useShallow } from 'zustand/shallow'

// CORRECT — shallow equality prevents infinite loop
const { connections, addConnection } = useConnectionStore(
  useShallow((s) => ({ connections: s.connections, addConnection: s.addConnection }))
)

// Also for arrays
const [a, b] = useStore(useShallow((s) => [s.a, s.b]))

// WRONG — new object reference every render
const { connections } = useConnectionStore((s) => ({ connections: s.connections }))
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

### `use()` Hook — Conditional Context / Promise Reading

```typescript
import { use } from 'react'

// Context: can be called inside conditionals (unlike useContext)
function Heading({ children }: { children?: ReactNode }) {
  if (!children) return null
  const theme = use(ThemeContext) // inside conditional — OK in React 19
  return <h1 style={{ color: theme.color }}>{children}</h1>
}
```

### `useActionState` — Async Action State Management

Replaces manual `isPending` / `error` state for form-like actions:

```typescript
import { useActionState } from 'react'

const [error, submitAction, isPending] = useActionState(
  async (_prev: string | null, formData: FormData) => {
    const err = await updateSetting(formData.get('key') as string)
    return err ?? null
  },
  null,
)
```

### ref Cleanup Function (React 19)

Return a cleanup function from a ref callback — useful for xterm.js lifecycle:

```typescript
<div
  ref={(el) => {
    if (!el) return
    const term = new Terminal()
    term.open(el)
    return () => term.dispose() // called on unmount
  }}
/>
```

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

### `<Context>` as Provider (React 19)

```typescript
// CORRECT — React 19
<ThemeContext value="dark">{children}</ThemeContext>

// OLD — still works but deprecated
<ThemeContext.Provider value="dark">{children}</ThemeContext.Provider>
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

### `unknown` at Boundaries — Explicit Annotation Required

```typescript
// CORRECT — explicit : unknown annotation in all catch blocks
try {
  await admobBannerShow(...)
} catch (err: unknown) {
  const msg = err instanceof Error ? err.message : String(err)
  console.warn('[AdMob] show failed:', msg)
}

// WRONG — omitting the annotation (even though strict mode implies unknown)
} catch (err) {
```

### Named Constants over Magic Values

```typescript
// src/shared/lib/constants.ts — SSOT for all magic values
export const STALE_TIME_FAST = 4_000
export const REFETCH_INTERVAL_FAST = 5_000
export const SSH_CONNECT_TIMEOUT_MS = 15_000
export const BACKGROUND_COOLDOWN_MS = 60 * 60 * 1_000  // 1 hour
export const MAX_CONNECTIONS = 5
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

## Vite 8

### `resolve.tsconfigPaths` — No Manual Alias Needed

Vite 8 reads TypeScript `paths` directly — no `resolve.alias` or `vite-tsconfig-paths` plugin:

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    tsconfigPaths: true, // reads @/* from tsconfig paths automatically
  },
})
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

// CORRECT — CSS variables, not env() directly
style={{ top: 'var(--sat, 0px)' }}

// WRONG — direct env() usage
style={{ top: 'env(safe-area-inset-top, 0px)' }}
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

### Structured Concurrency — `JoinSet` (tokio)

Use `JoinSet` to manage multiple tasks with automatic cancellation on drop:

```rust
use tokio::task::JoinSet;

// CORRECT — lifecycle tied to JoinSet scope
let mut set = JoinSet::new();
set.spawn(async move { session.run().await });
set.spawn(async move { keepalive_loop().await });

while let Some(result) = set.join_next().await {
    result??; // propagate panics and errors
}
// All tasks cancelled when set is dropped

// WRONG — handle dropped, task runs forever (leak)
tokio::spawn(async { session.run().await }); // handle ignored
```

### Cancellation — `CancellationToken` (tokio-util)

Propagate shutdown signals hierarchically:

```rust
use tokio_util::sync::CancellationToken;

let token = CancellationToken::new();
let child = token.child_token();

tokio::spawn(async move {
    tokio::select! {
        _ = child.cancelled() => { /* cleanup */ }
        result = do_work() => { /* normal completion */ }
    }
});

token.cancel(); // cancels all child tokens
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
