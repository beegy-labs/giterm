# CLAUDE.md — Claude Code Configuration

## Project

giterm — Tauri v2 + Rust + React desktop app (SSH terminal client)

## Commands

- `pnpm dev` — Start Vite dev server
- `pnpm build` — Build frontend
- `pnpm test:run` — Run Vitest
- `pnpm tauri dev` — Launch Tauri app (desktop dev mode)
- `pnpm tauri build` — Build production app
- `(echo 8; sleep 600) | pnpm tauri ios dev` — iOS simulator dev (iPhone 17 Pro)
- `cargo check --manifest-path src-tauri/Cargo.toml` — Check Rust
- `lsof -ti:1420 | xargs -r kill -9` — Kill stale Vite (before iOS dev)

## Rules

- TypeScript: strict mode, no `any`, use `@/` import alias
- Rust: all commands use `#[specta::specta]` + `#[tauri::command]`
- Tauri IPC: always via `features/*/adapters/api/` (out-adapter)
- Components: shadcn/ui in `shared/ui/`, Tailwind CSS v4
- State: Zustand stores in `entities/*/model/` or `features/*/model/`
- Tests: co-located `*.test.tsx` / `*.test.ts` files
- Design: Midnight Gentle Study theme (WCAG AAA), 8pt grid
- Privacy: NEVER display IP/username/port in UI — use connection name only
- Commits: conventional format (`feat:`, `fix:`, `chore:`)

## Frontend Architecture (FSD + Hexagonal Adapters)

```
src/
├── app/           — Bootstrap, providers
├── pages/         — Page compositions
├── widgets/       — Self-contained UI blocks
├── features/      — User-facing functionality (ui + model + adapters)
├── entities/      — Domain entities (store + UI)
├── shared/        — Reusable (ui, lib, config)
└── bindings.ts    — tauri-specta generated
```

**Dependency rule**: app → pages → widgets → features → entities → shared

## Structure

- `src/` — React frontend (FSD layers)
- `src-tauri/` — Rust backend (russh SSH)
- `.ai/` — CDD Tier 1 (navigation + rules)
- `.specs/` — SDD (roadmap, scopes, tasks)
- `docs/llm/` — CDD Tier 2 (app specs, policies)
