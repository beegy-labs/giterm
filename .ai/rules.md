# Rules — giterm

> Core development rules | **Last Updated**: 2026-02-19

## TypeScript

| Rule | Detail |
|------|--------|
| Strict mode | `strict: true`, no `any` |
| Imports | `@/` alias for `src/` |
| IPC | Always via tauri-specta bindings (`src/bindings.ts`) |
| Components | shadcn/ui + Tailwind CSS v4 |
| State | Zustand (UI), TanStack Query (async) |

## Rust

| Rule | Detail |
|------|--------|
| Commands | `#[specta::specta]` + `#[tauri::command]` |
| SSH | russh async, tokio runtime |
| Data flow | Tauri events for server→client, commands for client→server |
| Error handling | `Result<T, String>` for IPC commands |

## SSH

| Rule | Detail |
|------|--------|
| Library | russh 0.57.x |
| Auth | Password and private key support |
| Events | `ssh-data` event for remote output → xterm.js |
| Commands | `ssh_connect`, `ssh_write`, `ssh_resize`, `ssh_disconnect` |

## Commits

| Format | Example |
|--------|---------|
| Convention | `feat:`, `fix:`, `chore:`, `docs:` |
