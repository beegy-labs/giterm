# giterm — App Indicator

> SSH terminal client | Tauri v2 desktop + iOS app

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, xterm.js, shadcn/ui, Tailwind CSS v4 |
| Backend | Rust, russh 0.57.x, keyring (OS keychain) |
| Framework | Tauri v2, tauri-specta v2 RC |
| Design | Signal Dark — green-black + emerald (WCAG AAA) |

## Key Files

| File | Purpose |
|------|---------|
| `src-tauri/src/ssh/` | SSH module (client, session, tunnel, known_hosts, types) |
| `src-tauri/src/commands/` | ssh, tunnel, credential, admob, ime_log, viewport_log, debug_log |
| `src/widgets/terminal-view/` | TerminalView, HiddenImeInput, KeyboardToolbar + model hooks |
| `src/widgets/mobile-layout/` | MobileLayout (safe area SSOT), MobileConnectionList, MobileSessionTabBar |
| `src/features/ad-banner/` | AdMob banner — ObjC2 runtime (admob.rs), useAdBanner hook |
| `src/features/ssh-connect/` | SSH API + events + reconnect + closeSession |
| `src/features/server-monitor/` | Server stats parsing + query + useServerStats |
| `src/entities/session/model/sessionStore.ts` | Sessions + `selectActiveSession` selector |
| `src/entities/connection/model/connectionStore.ts` | Connections + `selectConnectionById` selector |
| `src/shared/adapters/` | credentialApi, sshExecApi, viewportLogApi, tauriStorage |
| `src/shared/lib/` | types, constants, statusColor, koreanIme, useVisualViewport, cpuSnapshotCache, iosInputFix |
| `docs/llm/features/ios-viewport.md` | iOS safe area SSOT (WebKit Bug #191872 + native ObjC fix) |

## Features

| Feature | Status |
|---------|--------|
| Multi-session tabs (max 5) | ✓ |
| SSH tunneling (max 20) | ✓ |
| Server monitoring (CPU/RAM/Disk) | ✓ |
| Korean IME (single-input) | ✓ |
| OS keychain credentials | ✓ |
| Host key verification (unknown/changed) | ✓ |
| AdMob + Coupang banner (ATT → AdMob or Coupang fallback) | ✓ |
| App exit cleanup (SSH+tunnels) | ✓ |
| iOS safe area native fix (WKWebView ObjC) | ✓ |
| iOS input zoom fix (font-size 16px) | ✓ |
| Tab switching (overlay pattern) | ✓ |
| iPhone xterm: CanvasAddon + DOM fallback patch | ✓ |
| i18n (en/ko/ja) | ⚠ (initialized, not wired) |

## Full Spec → `docs/llm/apps/giterm.md`
