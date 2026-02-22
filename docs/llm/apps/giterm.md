# giterm — App SSOT

> SSH terminal client | **Last Updated**: 2026-02-22

## Tech Stack

| Category | Choice | Version |
|----------|--------|---------|
| Desktop | Tauri v2 | ~2.10.x |
| Backend | Rust | 1.93+ |
| SSH | russh | 0.57.x |
| Frontend | React 19 + TypeScript 5.7+ | latest |
| Terminal UI | xterm.js + WebGL addon | 5.x |
| UI | shadcn/ui + Tailwind CSS v4 | latest |
| State | Zustand + TanStack Query | 5.x |
| Type Bridge | tauri-specta v2 | 2.0.0-rc |
| FE Arch | FSD + Hexagonal Adapters | - |

## Design System

| Token | Value | Note |
|-------|-------|------|
| Background | `#1E1C1A` | Deep Brown Charcoal |
| Surface | `#282522` | Cards, sidebar |
| Primary | `#D0B080` | Warm Golden Bronze |
| Text | `#CCC5BD` | 10.2:1 contrast |
| Secondary | `#9A9590` | 7.1:1 contrast |
| Border | `#3C3835` | |
| Grid | 8px | All spacing multiples |
| Radius | 4px | Terminal default |

Privacy: NEVER show IP/username/port — use connection name only.

## Frontend Architecture (FSD)

```
src/
├── app/        — Bootstrap, providers, i18n
├── pages/      — Page compositions (desktop + mobile)
├── widgets/    — terminal-view/, tab-bar/, sidebar/, server-dashboard/
├── features/   — ssh-connect/, ssh-reconnect/, server-monitor/, tunnel-manage/
├── entities/   — connection/, session/, tunnel/
└── shared/     — ui/, lib/, config/
```

Dependency rule: app → pages → widgets → features → entities → shared

## Backend Architecture

```
src-tauri/src/
├── ssh/
│   ├── client.rs   — russh Handler impl
│   ├── session.rs  — Session manager
│   └── types.rs    — ConnectionConfig, AuthMethod
└── commands/ssh.rs — Tauri IPC commands
```

## IPC Commands

| Command | Direction | Purpose |
|---------|-----------|---------|
| `ssh_connect` | FE→BE | Establish SSH connection |
| `ssh_write` | FE→BE | Send input to remote |
| `ssh_resize` | FE→BE | Resize remote PTY |
| `ssh_disconnect` | FE→BE | Close SSH session |
| `ssh_test_connection` | FE→BE | Test without shell |
| `ssh_exec` | FE→BE | Execute command on session |
| `tunnel_start` / `tunnel_stop` | FE→BE | Local port forwarding |
| `ssh-data` event | BE→FE | Stream remote output |
| `ssh-disconnect` event | BE→FE | Notify disconnection |

## State Management

| Store | Location | Persistence |
|-------|----------|-------------|
| connectionStore | entities/connection/ | localStorage |
| sessionStore | entities/session/ | Memory (max 5) |
| terminalSettingsStore | entities/session/ | localStorage (fontSize) |
| tunnelStore | entities/tunnel/ | Memory |

## Multi-Session

- `sessionStore` holds `sessions[]` + `activeIndex`
- `TerminalView` maintains `Map<sessionId, TermInstance>` (xterm + DOM node)
- Tab switch: `display:none/block` — no re-creation (preserves scrollback)
- xterm.js scrollback: 1000 (mobile) / 5000 (desktop)

## Touch Interaction

| Gesture | Action |
|---------|--------|
| Tap | Focus IME / move cursor to tap col |
| Long-press + drag | Text selection → Copy button |
| Vertical drag | Scroll → arrow key conversion |
| Tmux mode + drag | Auto copy mode + scroll arrows |
| Tmux mode + tap | Exit copy mode (`q`) |

`useTap` hook (touchEnd-based) distinguishes tap from horizontal scroll on toolbar.

## KeyboardToolbar

Main: `Ctrl` `Alt` `←↑↓→` `ESC` `Tab` `⌫` | `Tmux` `Copy` `Paste` `▼`

| Panel | Contents |
|-------|----------|
| Tmux | Win: +New/Prev/Next/Last/0-4; Pane: V\|/H—/Zoom/Cycle/Close; Etc: Detach/Cmd |
| Vi | h/j/k/l/w/b/0/$/g/G///n/q |
| Fn | F1–F12 |

## Development

| Command | Purpose |
|---------|---------|
| `pnpm tauri dev` | Desktop dev |
| `(echo 8; sleep 600) \| pnpm tauri ios dev` | iOS sim (iPhone 17 Pro = index 8) |
| `lsof -ti:1420 \| xargs -r kill -9` | Kill stale Vite port |
| `pnpm test:run` | Vitest |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Rust check |

IME log: `find ~/Library/Developer/CoreSimulator/Devices -name "giterm-ime-*.log" | sort | tail -1`

## iOS Build

| Item | Value |
|------|-------|
| Bundle ID | `com.vero.giterm` |
| Build command | `pnpm tauri ios build --export-method app-store-connect` |
| Build number | `YYMMDDHH.N` (UTC) via Xcode "Auto Build Number" post-build phase |
| Signing | Apple Distribution: JAEYOUNG LEE (4VF752P8A8) |
| Upload | Transporter app (Apple ID auth required) |

Tauri overwrites `CFBundleVersion` on every build — fixed by the Xcode post-build script.

## Known Pitfalls

- **StrictMode + Tauri `listen()`**: Use `cancelled` flag + ref-stored unlisten; deps must be `[]`.
- **Korean IME**: Single-input, `value=""` reset — full spec: `docs/llm/features/korean-ime.md`.
- **`focus()` in beforeinput**: iOS WKWebView does NOT immediately transfer first responder.
- **Tauri CFBundleVersion**: Overwritten by Tauri — solved by Xcode post-build script.

## References

- Indicator: `.ai/apps/giterm.md`
- Korean IME: `docs/llm/features/korean-ime.md`
- Roadmap: `.specs/apps/giterm/roadmap.md`
