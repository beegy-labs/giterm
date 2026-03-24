# Patterns: Zustand 5

> SSOT | **Last Updated**: 2026-03-24

## Primitive Selectors (no `useShallow` needed)

```typescript
// Primitive values — always stable
const userId = useAdBannerStore((s) => s.userId)
const adsEnabled = useAdBannerStore((s) => s.adsEnabled)
```

## `useShallow` — Object / Array Selectors (REQUIRED in v5)

Zustand 5: returning objects/arrays creates a new reference every render → infinite loop.

```typescript
import { useShallow } from 'zustand/shallow'

// CORRECT
const { connections, addConnection } = useConnectionStore(
  useShallow((s) => ({ connections: s.connections, addConnection: s.addConnection }))
)
const [a, b] = useStore(useShallow((s) => [s.a, s.b]))

// WRONG — infinite re-render
const { connections } = useConnectionStore((s) => ({ connections: s.connections }))
```

## External Selectors (SSOT)

```typescript
// src/entities/session/model/sessionStore.ts
export const selectActiveSession = (s: SessionState) =>
  s.sessions[s.activeIndex] ?? null

const session = useSessionStore(selectActiveSession)
```

## `partialize` for Persistence

```typescript
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

Secrets → OS keychain via `credentialApi`, never persisted store.

## Direct State Access Outside React

```typescript
const { userId, recordShown } = useAdBannerStore.getState()
useAdBannerStore.setState({ isBannerVisible: true })
```
