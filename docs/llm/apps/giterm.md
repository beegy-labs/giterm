# giterm — App SSOT

> SSH terminal client | **Last Updated**: 2026-02-19

## Overview

Desktop + iOS SSH terminal client built with Tauri v2 and russh.

## Tech Stack

| Category | Choice | Version |
|----------|--------|---------|
| Desktop | Tauri v2 | ~2.10.x |
| Backend | Rust | 1.93+ |
| SSH | russh | 0.57.x |
| Frontend | React 19 + TypeScript 5.7+ | latest |
| Build | Vite 6+ | latest |
| Terminal UI | xterm.js + WebGL addon | 5.x |
| UI | shadcn/ui + Tailwind CSS v4 | latest |
| State | Zustand + TanStack Query | 5.x |
| Type Bridge | tauri-specta v2 | 2.0.0-rc |
| Test | Vitest | 3.x |

## SSH Data Flow

```
User Input → xterm.js → Tauri cmd (ssh_write) → russh Channel → Remote Server
Remote Server → russh Channel → Tauri event (ssh-data) → xterm.js → Screen
```

## SSH Session Lifecycle

```
connect → authenticate (password/key) → open channel → request shell → data loop → disconnect
```

## IPC Commands

| Command | Direction | Purpose |
|---------|-----------|---------|
| `ssh_connect` | FE → BE | Establish SSH connection |
| `ssh_write` | FE → BE | Send user input to remote |
| `ssh_resize` | FE → BE | Resize remote PTY |
| `ssh_disconnect` | FE → BE | Close SSH session |
| `ssh-data` event | BE → FE | Stream remote output |

## Backend Architecture

```
src-tauri/src/
├── lib.rs              — Tauri app setup
├── main.rs             — Entry point
├── ssh/
│   ├── mod.rs          — Module exports
│   ├── client.rs       — russh Handler trait impl
│   ├── session.rs      — Session manager (connect, auth, channel)
│   └── types.rs        — ConnectionConfig, SessionState
└── commands/
    ├── mod.rs          — Command exports
    └── ssh.rs          — Tauri IPC commands
```

## Frontend Architecture

```
src/
├── components/
│   ├── layout/         — Layout, Sidebar
│   ├── ssh/            — ConnectionDialog
│   └── terminal/       — TerminalPanel (xterm.js)
├── stores/
│   ├── connection-store.ts  — Saved connections
│   ├── terminal-store.ts    — Terminal session state
│   └── app-store.ts         — UI state
└── bindings.ts         — tauri-specta generated
```

## Authentication

| Method | Implementation |
|--------|---------------|
| Password | Direct password authentication via russh |
| Private Key | Key file path → parse with russh-keys → authenticate |

## State Management

| Store | Scope | Persistence |
|-------|-------|-------------|
| connection-store | SSH connection configs | localStorage |
| terminal-store | Active sessions | Memory only |
| app-store | UI state (sidebar, dialogs) | Memory only |

## Security

| Concern | Approach |
|---------|----------|
| Host key verification | Accept on first connect (TOFU) |
| Password storage | Not stored (entered per session) |
| Key files | Read via Tauri fs, not stored |

## References

- Indicator: `.ai/apps/giterm.md`
- Roadmap: `.specs/apps/giterm/roadmap.md`
