# giterm Roadmap

> Product milestones | **Last Updated**: 2026-03-04

## Milestones

| Milestone | Name | Target | Status |
|-----------|------|--------|--------|
| M1 | SSH Terminal | Q1 2026 | **Completed** |
| M2 | Multi-tab + Extras | Q1 2026 | **Completed** |
| M3 | Agent Integration | Q3 2026 | Planned |
| M4 | Orchestration | Q4 2026 | Planned |

## M1: SSH Terminal (Q1 2026) -- Completed

Single SSH connection terminal with connection management.

- SSH connection via password/key authentication (+ jump host proxy)
- xterm.js terminal rendering with WebGL
- Connection save/load (localStorage)
- Desktop + iOS support
- Korean IME input handling
- iOS WKWebView caret/layout fix (10 layers)

## M2: Multi-tab + Extras (Q1 2026) -- Completed

Delivered ahead of schedule alongside M1.

- Multiple simultaneous SSH sessions (max 5 tabs)
- Tab-based terminal switching (display:none/block)
- Auto-reconnect with exponential backoff
- SSH tunneling (local port forwarding)
- Server monitoring (CPU/RAM/Disk)
- i18n (en/ko/ja)

## M3: Agent Integration (Q3 2026)

- AI-assisted terminal commands
- Command suggestions and autocomplete
- Session recording and replay

## M4: Orchestration (Q4 2026)

- Multi-server command execution
- Workflow automation
- Template-based operations
