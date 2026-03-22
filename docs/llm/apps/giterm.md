# giterm — App SSOT

> SSH terminal client | **Last Updated**: 2026-03-22

## Tech Stack

| Category | Choice | Version |
|----------|--------|---------|
| Desktop | Tauri v2 | ~2.10.x |
| Backend | Rust | 1.93+ |
| SSH | russh | 0.57.x |
| Frontend | React 19 + TypeScript 5.9+ | latest |
| Terminal UI | xterm.js + WebGL addon | 6.x |
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
├── app/           — Bootstrap, providers (QueryProvider), ErrorBoundary
├── pages/         — Page compositions (desktop + mobile)
├── widgets/       — terminal-view/, tab-bar/, sidebar/ (+ ServerDashboard), keyboard-shortcuts/, mobile-layout/
├── features/      — ssh-connect/, server-monitor/, tunnel-manage/, ime-log/, ad-banner/
├── entities/      — connection/, session/ (selectActiveSession), tunnel/
└── shared/        — ui/, lib/ (types, constants, cpuSnapshotCache, statusColor, koreanIme), config/, adapters/ (credentialApi, sshExecApi, viewportLogApi, tauriStorage)
```

Dependency rule: app → pages → widgets → features → entities → shared

Key patterns:
- **Selectors**: Derived state via exported selectors (e.g. `selectActiveSession`), not store getters
- **Event adapters**: Tauri `listen()` wrapped in `features/*/adapters/events/`, never in UI
- **Query factories**: `queryOptions()` in features (`server-monitor/model/`), CPU cache in `shared/lib/cpuSnapshotCache.ts`
- **Shared adapters**: Tauri IPC wrappers (`credentialApi`, `sshExecApi`, `viewportLogApi`, `tauriStorage`) in `shared/adapters/`
- **Shared types**: `SessionStatus` defined in `shared/lib/types.ts`, re-exported from `entities/session/` — SSOT for domain types
- **Shared constants**: `SSH_DEFAULT_PORT`, `isValidPort()`, `MAX_CONNECTIONS/SESSIONS/TUNNELS` in `shared/lib/constants.ts`
- **Shared lib**: Cross-feature utilities (`statusColor`, `koreanIme`, `useVisualViewport`, `cpuSnapshotCache`) in `shared/lib/`
- **Slot injection**: Cross-widget composition via page-level slot props (e.g. `MobileLayout.terminalView`), not direct widget→widget imports

## Backend Architecture

```
src-tauri/src/
├── ssh/
│   ├── client.rs       — russh Handler impl
│   ├── session.rs      — Session manager (+ jump host), named constants
│   ├── tunnel.rs       — Port forwarding
│   ├── known_hosts.rs  — Host key verification
│   └── types.rs        — ConnectionConfig, AuthMethod (manual Debug redacts secrets)
└── commands/           — ssh, tunnel, credential, ime_log, viewport_log
```

## IPC Commands

| Command | Direction | Purpose |
|---------|-----------|---------|
| `ssh_connect` | FE→BE | Establish SSH connection (+ jump host) |
| `ssh_write` | FE→BE | Send input to remote |
| `ssh_resize` | FE→BE | Resize remote PTY |
| `ssh_disconnect` | FE→BE | Close SSH session |
| `ssh_test_connection` | FE→BE | Test without shell |
| `ssh_exec` | FE→BE | Execute command on session |
| `ssh_host_key_verify_respond` | FE→BE | Accept/reject host key (HostKeyVerifyDialog) |
| `credential_store/get/delete/delete_all` | FE→BE | OS keychain CRUD |
| `tunnel_start` / `tunnel_stop` | FE→BE | Local port forwarding |
| `ime_log_start/append/stop` | FE→BE | Dev IME file logging |
| `vp_log_start/append/stop` | FE→BE | Dev viewport file logging |
| `ssh-data` event | BE→FE | Stream remote output |
| `ssh-disconnect` event | BE→FE | Notify disconnection |
| `ssh-host-key-verify` event | BE→FE | Host key verification prompt (unknown/changed) |

## State Management

| Store | Location | Persistence | Notes |
|-------|----------|-------------|-------|
| connectionStore | entities/connection/ | tauriStorage (full JSON incl. passwords) + OS keychain fallback | `partialize` passes full state; `loadSecrets()` enriches from keychain as fallback |
| sessionStore | entities/session/ | Memory (max 5) | Use `selectActiveSession` selector |
| terminalSettingsStore | entities/session/ | tauriStorage (tauri-plugin-store, fontSize) | |
| tunnelStore | entities/tunnel/ | Memory (max 20) | `addTunnel` returns `boolean` |

Server stats use TanStack Query (`features/server-monitor/model/useServerStats.ts`) with `staleTime: 4s`, `refetchInterval: 5s`. CPU delta cache in `shared/lib/cpuSnapshotCache.ts`.

## Multi-Session

- `sessionStore` holds `sessions[]` + `activeIndex`; `selectActiveSession` computes active session
- `useTerminalInstances` hook manages `Map<sessionId, TermInstance>` (xterm + DOM node); ResizeObserver: `fit()` debounced 100ms, `sshResize()` debounced 150ms
- `useSshEvents` hook subscribes to SSH data/disconnect via adapter (not raw `listen()`)
- `useTouchGestures` hook encapsulates all touch/scroll/selection logic
- Tab switch: `display:none/block` — no re-creation (preserves scrollback)
- xterm.js scrollback: 1000 (mobile) / 5000 (desktop)

## Touch & KeyboardToolbar

- Tap: focus IME / cursor to col | Long-press+drag: selection → Copy | Vertical drag: scroll/arrows
- Toolbar: `[⌨/가/조합]` `[scrollable keys]` `[▼ panel]` — panels: Tmux, Vi, Fn (F1-F12)

## Development

| Command | Purpose |
|---------|---------|
| `pnpm tauri dev` | Desktop dev |
| `(echo 8; sleep 600) \| pnpm tauri ios dev` | iOS sim (iPhone 17 Pro = index 8) |
| `lsof -ti:1420 \| xargs -r kill -9` | Kill stale Vite port |
| `pnpm test:run` | Vitest |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Rust check |

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

- **StrictMode + Tauri `listen()`**: `subscribeSshData`/`subscribeSshDisconnect` adapter uses `cancelled` flag pattern.
- **Korean IME**: Single-input, `value=""` reset. See `docs/llm/features/korean-ime.md`.
- **iOS caret**: 10-layer fix. See `docs/llm/features/ios-caret-fix.md`.
- **iOS viewport shrink (WebKit Bug #191872)**: WKWebView physically resizes layout viewport when safe area settles (e.g. 840→778px, ~3–7s after launch). Fixed via native ObjC retry loop: `setMinimumViewportInset`, pin frame to window bounds, neutralize UIViewController `additionalSafeAreaInsets`. See `docs/llm/features/ios-viewport.md`.
- **iOS safe area CSS**: `env(safe-area-inset-*)` starts at 0 and settles late — NEVER use for layout. Use `--sat`/`--sab` CSS vars injected by native code before first paint. `pt-safe-bar`/`pt-safe-header` use `var(--sat)` only.
- **Safe area placement**: `pt-safe-bar` on **individual headers** (MobileScreen.Header, MobileSessionTabBar) only — NEVER on MobileLayout container. Container padding reduces flex children's available space causing visible shrink.
- **iOS input zoom**: WKWebView auto-zooms inputs with font-size < 16px. Fixed via `@supports (-webkit-touch-callout: none) { font-size: 16px }`. See `src/shared/lib/iosInputFix.ts` for scroll-into-view SSOT.
- **`focus()` in beforeinput**: iOS WKWebView does NOT immediately transfer first responder.
- **iOS keyboard resize**: ResizeObserver `fit()` debounced 100ms, `sshResize()` debounced 150ms in `useTerminalInstances` + dedup cache in `sshApi.ts`. `useVisualViewport` `--vvh` updates debounced 100ms.
- **Tab switching**: TerminalView uses overlay pattern (absolute overlays) not early returns — early returns unmount the container div, destroying ALL xterm instances. MobileLayout uses `hidden` class toggling, not conditional rendering.
- **WebGL on iOS**: Skip WebGL addon on mobile — iOS has a hard limit on WebGL contexts. `useTerminalInstances` checks `isMobile` before creating WebGL renderer.
- **Credentials**: Passwords stored in tauriStorage JSON (reliable across restarts). OS keychain via Rust `keyring` crate as fallback (`loadSecrets()`). `SECRET_FIELDS` (FE) ↔ `ALLOWED_FIELDS` (BE) must stay in sync.
- **App exit cleanup**: `RunEvent::Exit` handler calls `SshSessionManager::disconnect_all()` + `TunnelManager::stop_all()` + debug log `cleanup()`.
- **ErrorBoundary**: Class component wrapping app root (React 19 requirement).
- **iOS dev mode — WKWebView origin**: WKWebView loads via `tauri://localhost` (NOT `http://127.0.0.1:1420`). Tauri scheme handler proxies `tauri://localhost/*` → devUrl via reqwest. `fetch('/src/main.tsx')` returns HTTP 200 (proxy works), BUT `<script type="module" src="/src/main.tsx">` does NOT execute → React never mounts → white screen. **Root cause unresolved** as of 2026-03-22. Investigation: inline scripts run, inline module scripts run, only external module src fails.
- **iOS dev mode — devUrl must be `127.0.0.1`**: `devUrl: "http://localhost:1420"` causes reqwest to resolve `localhost` → `127.0.0.1` (IPv4) while Vite binds to `::1` (IPv6, `host: false`) → ECONNREFUSED. Fix: `devUrl: "http://127.0.0.1:1420"` + `vite.config.ts host: "0.0.0.0"` (current state).
- **iOS dev mode — Vite host**: Must be `"0.0.0.0"` (IPv4 wildcard) not `false` (IPv6 only). Set via `TAURI_DEV_HOST` env or vite.config.ts fallback.
