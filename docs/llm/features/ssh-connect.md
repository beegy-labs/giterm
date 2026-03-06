# SSH Connect — Feature SSOT

> Core SSH connection, reconnect, session lifecycle | **Last Updated**: 2026-03-07

## Structure

```
features/ssh-connect/
├── adapters/
│   ├── api/sshApi.ts             — Tauri IPC wrappers + withTimeout utility
│   └── events/sshEventAdapter.ts — listen() wrappers (Data, Disconnect, HostKeyVerify)
├── model/
│   ├── startSession.ts           — Placeholder lifecycle (connecting → connected/error)
│   ├── useConnect.ts             — Dialog connection flow hook
│   ├── useConnectionValidation.ts — Form validation with useMemo + shared isValidPort()
│   ├── useReconnect.ts           — reconnectSession(), cancelReconnect()
│   ├── closeSession.ts           — Teardown: disconnect + cleanup + removeSession
│   ├── connectStore.ts           — Dialog open/editing state (Zustand)
│   └── hostKeyVerifyStore.ts     — Pending host key verification (Zustand)
└── ui/
    ├── ConnectionDialog.tsx       — Form with jump host support
    └── HostKeyVerifyDialog.tsx    — Unknown/changed host key dialog
```

## Connection Flow

1. `startSession()` creates placeholder session (status: `connecting`)
2. `connectFromConfig()` → `loadSecrets(conn)` → `buildSshConfig()` → `sshConnect()`
3. `sshConnect()` → Rust backend with 65s frontend timeout (`withTimeout`)
4. Success → `connected` | Failure → `error` with `classifySshError()` message

## Reconnect

- `reconnectSession(sessionId)`: sets `reconnecting`, calls `connectFromConfig()`, updates sessionId on success
- `cancelReconnect(sessionId)`: sets `cancelled` flag, reverts to `disconnected`
- Module-level `Map<sessionId, cancel>` — survives re-renders

## Close Session

`closeSession(sessionId)`: cancelReconnect → sshDisconnect → clearCpuSnapshot → removeSession

## Credential Storage

- `connectionStore.partialize` strips secrets from tauriStorage disk persistence
- `saveSecrets()` writes to OS keychain via Rust `keyring` crate (both desktop + iOS); called **after** limit check in `addConnection`
- `loadSecrets()` enriches from keychain at connect time
- iOS: keychain works through Tauri IPC → Rust native `Security.framework`
- `SECRET_FIELDS` (FE) ↔ `ALLOWED_FIELDS` (BE) — cross-referenced sync comments

## Host Key Verification

1. Rust checks `~/.giterm/known_hosts` → Unknown/Changed → emits event, waits on oneshot
2. `HostKeyVerifyDialog` shows fingerprint (no host/IP — privacy)
3. Accept → key saved | Reject → connection fails

## Resize Optimization

`sshResize()` caches last `cols×rows` per session — skips duplicate IPC calls.
