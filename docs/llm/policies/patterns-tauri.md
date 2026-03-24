# Patterns: Tauri v2 IPC + Vite 8

> SSOT | **Last Updated**: 2026-03-24

## Adapter Wrapper (Never Invoke from UI)

```typescript
// src/features/ssh-connect/adapters/api/sshApi.ts
import { invoke } from '@tauri-apps/api/core'

export function sshConnect(config: ConnectionConfig): Promise<string> {
  return invoke('ssh_connect', { config })
}

// UI calls the adapter, never invoke() directly
const sessionId = await sshConnect(config)
```

## Event Adapter (Never listen() from UI)

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

## StrictMode Double-Subscribe Guard

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

## Vite 8 — `resolve.tsconfigPaths`

No manual alias or `vite-tsconfig-paths` plugin needed:

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    tsconfigPaths: true, // reads @/* from tsconfig paths
  },
})
```
