# giterm

> CDD Layer 1 — Entry Point (≤50 lines) | **Last Updated**: 2026-03-24

## Project

**giterm** — Tauri v2 + Rust SSH terminal client (React 19 + xterm.js, iOS + Desktop).

## Navigation

| Action | Read |
|--------|------|
| Core rules | `.ai/rules.md` |
| Architecture | `.ai/architecture.md` |
| Git & commits | `.ai/git-flow.md` |
| Code patterns (2026) | `docs/llm/policies/patterns.md` |
| Code review checklist | `.ai/code-review.md` |
| Dependency upgrade policy | `docs/llm/policies/dependency-upgrade.md` |
| Full docs index | `docs/llm/README.md` |
| App SSOT | `docs/llm/apps/giterm.md` |
| Testing strategy | `docs/llm/policies/tdd.md` |

## Key Docs by Feature

| Feature | Path | Content |
|---------|------|---------|
| iOS Viewport | `docs/llm/features/ios-viewport.md` | `--vvh`, safe area, WebKit Bug #191872 |
| Korean IME | `docs/llm/features/korean-ime.md` | Single-input, delete+insert pairs |
| iOS Caret Fix | `docs/llm/features/ios-caret-fix.md` | 10-layer WKWebView scroll/caret fix |
| Ad Banner | `docs/llm/features/ad-banner.md` | AdMob + Coupang, ATT flow |
| SSH Connect | `docs/llm/features/ssh-connect.md` | Connection, auth, 10s timeout |
| Server Monitor | `docs/llm/features/server-monitor.md` | CPU/RAM/Disk parsing |
| Tunnel | `docs/llm/features/tunnel-manage.md` | Local port forwarding |
| App Lifecycle | `docs/llm/features/app-lifecycle.md` | Exit cleanup |
