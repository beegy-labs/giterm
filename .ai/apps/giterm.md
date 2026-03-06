# giterm — App Indicator

> SSH terminal client | Tauri v2 desktop + iOS app

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, xterm.js, shadcn/ui, Tailwind CSS v4 |
| Backend | Rust, russh 0.57.x, keyring (OS keychain) |
| Framework | Tauri v2, tauri-specta v2 RC |
| Design | Midnight Gentle Study (WCAG AAA) |

## Key Files

| File | Purpose |
|------|---------|
| `src-tauri/src/ssh/` | SSH module (client, session, tunnel, known_hosts, types) |
| `src-tauri/src/commands/` | ssh, tunnel, credential, ime_log, viewport_log |
| `src/widgets/terminal-view/` | TerminalView, HiddenImeInput, KeyboardToolbar + model hooks |
| `src/widgets/mobile-layout/` | MobileLayout, MobileConnectionList, MobileSessionTabBar |
| `src/widgets/keyboard-shortcuts/` | Keyboard shortcuts widget |
| `src/widgets/sidebar/` | Connection list + server dashboard |
| `src/features/ssh-connect/` | SSH API + events + reconnect + closeSession |
| `src/features/server-monitor/` | Server stats parsing + query + useServerStats |
| `src/entities/session/model/sessionStore.ts` | Sessions + `selectActiveSession` selector |
| `src/entities/connection/model/connectionStore.ts` | Connections + `selectConnectionById` selector |
| `src/shared/adapters/` | credentialApi, sshExecApi, viewportLogApi, tauriStorage |
| `src/shared/lib/` | types, constants, statusColor, koreanIme, useVisualViewport, cpuSnapshotCache |

## Features

| Feature | Status |
|---------|--------|
| Multi-session tabs (max 5) | ✓ |
| SSH tunneling (max 20) | ✓ |
| Server monitoring (CPU/RAM/Disk) | ✓ |
| Korean IME (single-input) | ✓ |
| OS keychain credentials | ✓ |
| Host key verification (unknown/changed) | ✓ |
| i18n (en/ko/ja) | ⚠ (initialized, not wired) |

## Dev Commands

| Command | Purpose |
|---------|---------|
| `(echo 8; sleep 600) \| pnpm tauri ios dev` | iOS sim (iPhone 17 Pro) |
| `lsof -ti:1420 \| xargs -r kill -9` | Kill stale Vite port |

## Full Spec → `docs/llm/apps/giterm.md`
