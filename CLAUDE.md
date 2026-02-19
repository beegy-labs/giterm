# CLAUDE.md — Claude Code Configuration

## Project

giterm — Tauri v2 + Rust + React desktop app (SSH terminal client)

## Commands

- `pnpm dev` — Start Vite dev server
- `pnpm build` — Build frontend
- `pnpm test:run` — Run Vitest
- `pnpm tauri dev` — Launch Tauri app (dev mode)
- `pnpm tauri build` — Build production app
- `cargo check --manifest-path src-tauri/Cargo.toml` — Check Rust

## Rules

- TypeScript: strict mode, no `any`, use `@/` import alias
- Rust: all commands use `#[specta::specta]` + `#[tauri::command]`
- Tauri IPC: always via tauri-specta generated bindings (`src/bindings.ts`)
- Components: shadcn/ui primitives, Tailwind CSS v4 utilities
- State: Zustand for UI, TanStack Query for async
- Tests: co-located `*.test.tsx` / `*.test.ts` files
- Commits: conventional format (`feat:`, `fix:`, `chore:`)

## Structure

- `src/` — React frontend
- `src-tauri/` — Rust backend (russh SSH)
- `.ai/` — CDD Tier 1 (navigation + rules)
- `.specs/` — SDD (roadmap, scopes, tasks)
- `docs/llm/` — CDD Tier 2 (app specs, policies)
