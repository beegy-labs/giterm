# docs/llm — Index

> Layer 2 CDD | Machine-optimized SSOT | **Last Updated**: 2026-03-24

## Apps

| Doc | Purpose |
|-----|---------|
| `apps/giterm.md` | Full app SSOT — stack, IPC commands, state, iOS build, known pitfalls |

## Features

| Doc | Domain |
|-----|--------|
| `features/ios-viewport.md` | `--vvh`, safe area native fix, WebKit Bug #191872 |
| `features/ios-caret-fix.md` | Layers 1–4: UIScrollView, no-transform, position:fixed |
| `features/ios-caret-fix-impl.md` | Layers 5–8: safe area arch, scroll reset, inputMode, CSS vars |
| `features/ios-caret-fix-advanced.md` | Layers 9–10: hit-region refresh, DOM order |
| `features/korean-ime.md` | Single-input architecture, delete+insert pair detection |
| `features/ad-banner.md` | AdMob ObjC2 + Coupang fallback, ATT, display rules |
| `features/ssh-connect.md` | SSH connect, auth methods, 10s Rust timeout |
| `features/server-monitor.md` | CPU/RAM/Disk stat parsing, TanStack Query |
| `features/tunnel-manage.md` | Local port forwarding, max 20 tunnels |
| `features/app-lifecycle.md` | Exit cleanup (SSH disconnect_all + tunnel stop_all + logs) |
| `features/ime-log.md` | IME debug file logging |

## Policies

| Doc | Purpose |
|-----|---------|
| `policies/patterns.md` | **2026 code patterns** — React 19, Zustand 5, TanStack Query v5, Tauri v2, Tailwind v4 |
| `policies/tdd.md` | Testing strategy (Trophy: unit → integration → manual) |
| `policies/dependency-upgrade.md` | Dependency upgrade policy — when, how, breaking change checklist |
