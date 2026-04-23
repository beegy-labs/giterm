# Architecture

> CDD Layer 1 — Architecture pointer (≤50 lines) | **Last Updated**: 2026-03-24

## Frontend (FSD + Hexagonal Adapters)

```
src/
├── app/       — Bootstrap, QueryProvider, ErrorBoundary
├── pages/     — Page compositions (TerminalPage)
├── widgets/   — terminal-view/, mobile-layout/, sidebar/
├── features/  — ssh-connect/, ad-banner/, server-monitor/, tunnel-manage/, ime-log/
├── entities/  — connection/, session/, tunnel/ (stores + selectors)
└── shared/    — ui/, lib/, adapters/, queries/
```

**Dependency rule**: app → pages → widgets → features → entities → shared
Features NEVER import other features — shared logic belongs in `shared/lib/`.

Adapters: API calls → `features/*/adapters/api/`, Events → `features/*/adapters/events/`.
State: Zustand stores in `entities/*/model/`, derived state via exported selectors.
Queries: `queryOptions()` factories in `shared/queries/` or feature `model/`.

## Backend (Tauri v2 + Rust)

```
src-tauri/src/
├── ssh/        — client, session, tunnel, known_hosts, types
└── commands/   — ssh, tunnel, credential, admob, ime_log, viewport_log, debug_log
```

All commands: `#[specta::specta]` + `#[tauri::command]`.
IPC: commands (FE→BE) via `invoke()`, events (BE→FE) via `emit()`/`listen()`.
Secrets: OS keychain via `keyring` crate. Never persist raw secrets in store.

## iOS Overlay System

| CSS Var | Value | Shrinks with keyboard? | Used by |
|---------|-------|----------------------|---------|
| `--app-h` | `window.innerHeight`, set once | No | `overlay-fullscreen` backdrop |
| `--vvh` | `visualViewport.height` | **Yes** | Terminal section, dialog centering |
| `--sat` / `--sab` | Native ObjC injection | — | Safe area padding |

Dialog centering wrapper uses `--vvh` → dialogs stay above keyboard.
`overlay-fullscreen` uses `--app-h` → backdrops always fill full screen.

**SSOT**: `docs/llm/apps/giterm.md`
