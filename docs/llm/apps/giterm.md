# giterm — App SSOT

> SSH terminal client | **Last Updated**: 2026-03-23

## Tech Stack

| Category | Choice | Version |
|----------|--------|---------|
| Desktop | Tauri v2 | ~2.10.x |
| Backend | Rust | 1.93+ |
| SSH | russh | 0.57.x |
| Frontend | React 19 + TypeScript 5.9+ | latest |
| Terminal UI | xterm.js 6 + Canvas/WebGL addons | 6.x |
| UI | shadcn/ui + Tailwind CSS v4 | latest |
| State | Zustand + TanStack Query | 5.x |
| Type Bridge | tauri-specta v2 | 2.0.0-rc |
| FE Arch | FSD + Hexagonal Adapters | - |

## Design System

Signal Dark — veronex-inspired green-black terminal theme (WCAG 2.1 AAA).

| Token | Value | Note |
|-------|-------|------|
| Background | `#0B0E0C` | Obsidian Deep (green-tinted near-black) |
| Surface | `#111512` | Cards, sidebar |
| Primary | `#10B981` | Bio-Emerald — 7.7:1 contrast ✓ AAA |
| Text | `#DCE8DF` | Soft green-white — 14.2:1 contrast ✓ AAA |
| Secondary | `#88A896` | Muted — 7.4:1 contrast ✓ AAA |
| Border | `#222E28` | |
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
└── commands/           — ssh, tunnel, credential, admob, ime_log, viewport_log
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
| `admob_request_att` | FE→BE | ATT authorization popup (iOS 14+) — call before admob_init |
| `admob_init` / `admob_banner_show` / `admob_banner_hide` / `admob_banner_is_visible` | FE→BE | AdMob SDK init + GADBannerView lifecycle (iOS ObjC2 runtime) |
| `ime_log_*/vp_log_*` | FE→BE | Dev file logging (IME + viewport) |
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

Server stats: TanStack Query, `staleTime: 4s`, `refetchInterval: 5s`, CPU delta cache in `shared/lib/cpuSnapshotCache.ts`.

## Multi-Session

- `sessionStore` holds `sessions[]` + `activeIndex`; `selectActiveSession` computes active session
- `useTerminalInstances` hook manages `Map<sessionId, TermInstance>` (xterm + DOM node); ResizeObserver: `fit()` debounced 100ms, `sshResize()` debounced 150ms; mobile uses `CanvasAddon`, desktop uses `WebglAddon`
- `useSshEvents` hook subscribes to SSH data/disconnect via adapter (not raw `listen()`)
- `useTouchGestures` hook encapsulates all touch/scroll/selection logic
- xterm.js scrollback: 1000 (mobile) / 5000 (desktop)

### iOS Terminal Rendering

- iPhone WKWebView DOM renderer is unreliable — may show white/faint text even when simulator looks correct.
- Fix: mobile loads `@xterm/addon-canvas` (Canvas2D) after `term.open()`; WebGL desktop-only.
- `term.open()` must be called while element is visible (`display:block`) so canvas initializes at correct dimensions. Call `fitAddon.fit()` immediately after, then hide via `visibility:hidden` (never `display:none` — drops canvas renderer on iOS).
- `ensureXtermDomFallback()` patches xterm DOM subtree CSS directly as a safety net against WKWebView style inheritance.
- `DEFAULT_XTERM_THEME` sets full ANSI palette explicitly to prevent CSS color inheritance from app theme.

## iOS Build

| Item | Value |
|------|-------|
| Bundle ID | `com.vero.giterm` |
| Deployment target | iOS 14.0 |
| Required capabilities | arm64, metal |
| Team ID | `4VF752P8A8` (Apple Distribution: JAEYOUNG LEE) |
| Build command | `pnpm tauri ios build` |
| Build number policy | `YYMMDDHH.N` (UTC 기준 년월일시.배포수) — e.g. `26032308.1` |
| Build number file | `.build_number` (gitignored — set locally before each release build) |
| Signing | `CODE_SIGN_STYLE: Automatic` in `project.yml` |
| Upload | Transporter app (drag `.ipa` from `src-tauri/gen/apple/build/arm64/`) |

**Build number**: Tauri overwrites `CFBundleVersion` — fixed by `postBuildScripts` in `project.yml` that patches bundle Info.plist from `.build_number` file (runs after ProcessInfoPlistFile, before CodeSign).

**libapp.a conflict**: `project.yml` excludes `- path: Externals` from sources. After release build, delete `Externals/arm64/release/` before dev builds to avoid "Multiple commands produce libapp.a".

## Known Pitfalls

- **Korean IME**: Single-input, `value=""` reset. See `docs/llm/features/korean-ime.md`.
- **iOS viewport shrink**: WebKit Bug #191872, native ObjC fix. See `docs/llm/features/ios-viewport.md`.
- **iOS safe area CSS**: NEVER use `env(safe-area-inset-*)`. Use `--sat`/`--sab` only. `pt-safe-bar` on individual headers — NEVER on MobileLayout container.
- **iOS caret**: 10-layer fix. See `docs/llm/features/ios-caret-fix.md`.
- **iOS input zoom**: font-size < 16px triggers zoom. Fixed in `src/shared/lib/iosInputFix.ts`.
- **iOS keyboard resize**: `fit()` debounced 100ms, `sshResize()` 150ms, `--vvh` 100ms.
- **Touch selection drift (normal mode)**: Long-press fires 400ms after touchStart. New SSH output arriving during that wait increments `baseY`, shifting selection down. Fix: snapshot `baseY` at touchStart (`selectionBaseYRef`) and pass as `preBaseY` to `touchToCell`. Alt screen (tmux) unaffected (`baseY` always 0).
- **xterm on iPhone**: simulator OK ≠ real device OK. Use `@xterm/addon-canvas` on mobile; `ensureXtermDomFallback()` patches DOM CSS. Init order: `open()` while visible → `fit()` → hide via `visibility:hidden` (never `display:none` — drops canvas renderer; opening hidden causes 0×0 canvas, `fit()` no-ops on cell.width===0).
- **WebGL on iOS**: hard context limit — skip WebGL addon on mobile (`isMobile` in `useTerminalInstances`).
- **Tab switching**: overlay pattern only — conditional render destroys xterm instances.
- **AdMob simulator**: `GADMobileAds class not found` is expected (graceful ObjC2 no-op). `GADApplicationIdentifier` in `project.yml info.properties` required or app crashes on launch.
- **Credentials**: `SECRET_FIELDS` (FE) ↔ `ALLOWED_FIELDS` (BE) must stay in sync. `loadSecrets()` enriches from keychain at connect time.
- **StrictMode + `listen()`**: adapter uses `cancelled` flag to prevent double-subscription.
- **App exit**: `RunEvent::Exit` → `disconnect_all()` + `stop_all()` + debug `cleanup()`.
- **iOS dev mode**: `devUrl: "http://127.0.0.1:1420"` + `vite host: "0.0.0.0"` required. External `<script type="module" src=...>` does NOT execute in WKWebView (unresolved 2026-03-22).
