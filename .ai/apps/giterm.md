# giterm — App Indicator

> SSH terminal client | Tauri v2 desktop + iOS app

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, xterm.js 5.x, shadcn/ui |
| Backend | Rust, russh 0.57.x |
| Framework | Tauri v2 |
| Type Bridge | tauri-specta v2 RC |

## Data Flow

```
User Input → xterm.js → ssh_write cmd → russh Channel → Remote
Remote → russh Channel → ssh-data event → xterm.js → Screen
```

## Key Files

| File | Purpose |
|------|---------|
| `src-tauri/src/ssh/` | SSH module (client, session, types) |
| `src-tauri/src/commands/ssh.rs` | Tauri IPC commands |
| `src/components/terminal/` | xterm.js terminal panel |
| `src/components/ssh/` | Connection dialog |
| `src/stores/` | Zustand stores |

## Full Spec

→ `docs/llm/apps/giterm.md`
