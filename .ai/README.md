# .ai — Navigation Hub

> giterm project context | **Architecture**: Tauri v2 + Rust + russh (SSH)

## Quick Links

| Resource | Path | Purpose |
|----------|------|---------|
| Rules | `.ai/rules.md` | Core DO/DON'T |
| App Spec | `.ai/apps/giterm.md` | App indicator |
| Full Spec | `docs/llm/apps/giterm.md` | App SSOT (Tier 2) |
| Feature Docs | `docs/llm/features/*.md` | Per-feature SSOT (9 docs, Tier 2) |
| Roadmap | `.specs/apps/giterm/roadmap.md` | Milestones |

## Architecture

```
Frontend (React + xterm.js)
    ↕ Tauri IPC (tauri-specta)
Backend (Rust + russh)
    ↕ SSH Protocol
Remote Server
```

## Policies

| Policy | Path |
|--------|------|
| CDD | `docs/llm/policies/cdd.md` |
| SDD | `docs/llm/policies/sdd.md` |
| ADD | `docs/llm/policies/add.md` |
