# giterm — App Indicator

> SSH terminal client | Tauri v2 desktop + iOS app

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, xterm.js, shadcn/ui, Tailwind CSS v4 |
| Backend | Rust, russh 0.57.x |
| Framework | Tauri v2 |
| Type Bridge | tauri-specta v2 RC |
| Design | Midnight Gentle Study (WCAG AAA) |

## Key Files

| File | Purpose |
|------|---------|
| `src-tauri/src/ssh/` | SSH module (client, session, types) |
| `src/widgets/terminal-view/` | Terminal + HiddenImeInput + KeyboardToolbar |
| `src/widgets/tab-bar/` | Desktop multi-session tabs |
| `src/widgets/sidebar/` | Connection list + server dashboard |
| `src/features/ssh-connect/` | SSH connection feature |
| `src/shared/lib/koreanImeProcessor.ts` | IME pure logic (SSOT) |
| `src/shared/lib/escapeSequences.ts` | Escape sequences (SSOT) |

## Features

| Feature | Status |
|---------|--------|
| Multi-session tabs (max 5) | ✓ |
| Auto-reconnect (exp. backoff) | ✓ |
| SSH tunneling | ✓ |
| Server monitoring (CPU/RAM/Disk) | ✓ |
| Korean IME (single-input) | ✓ |
| i18n (en/ko/ja) | ✓ |

## Dev Commands

| Command | Purpose |
|---------|---------|
| `(echo 8; sleep 600) \| pnpm tauri ios dev` | iOS sim (iPhone 17 Pro) |
| `lsof -ti:1420 \| xargs -r kill -9` | Kill stale Vite port |

## Full Spec

→ `docs/llm/apps/giterm.md`

## Korean IME

→ `docs/llm/features/korean-ime.md`
