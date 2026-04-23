# Code Patterns: giterm — 2026 Reference

> Index | **Last Updated**: 2026-03-24
> React 19 · TypeScript 6 · Zustand 5 · TanStack Query v5 · Tailwind v4 · Tauri v2 · Rust Edition 2021

## Technology Patterns

| Doc | Stack |
|-----|-------|
| `patterns-query.md` | TanStack Query v5 — queryOptions, timing, mutations, useSuspenseQuery |
| `patterns-zustand.md` | Zustand 5 — useShallow, external selectors, partialize |
| `patterns-react.md` | React 19 — use(), useActionState, ref cleanup, useOptimistic |
| `patterns-typescript.md` | TypeScript 6 — discriminated unions, unknown, named constants |
| `patterns-tauri.md` | Tauri v2 IPC + Vite 8 — adapters, events, tsconfigPaths |
| `patterns-rust.md` | Rust — commands, JoinSet, CancellationToken, secret redaction |
| `patterns-tailwind.md` | Tailwind v4 — @theme, overlay-fullscreen, safe area vars |

## Adding a New Feature

| Step | File | Action |
|------|------|--------|
| 1 | `docs/llm/features/new-feature.md` | Write CDD doc first |
| 2 | `src/features/new-feature/model/newStore.ts` | Zustand store |
| 3 | `src/features/new-feature/adapters/api/newApi.ts` | IPC wrappers |
| 4 | `src/features/new-feature/adapters/events/newEvents.ts` | Event adapters (if needed) |
| 5 | `src/features/new-feature/ui/NewComponent.tsx` | UI (reads from model only) |
| 6 | `src/features/new-feature/index.ts` | Public exports |
| 7 | `src-tauri/src/commands/new.rs` | Rust commands (if needed) |
| 8 | `docs/llm/README.md` | Add to features table |
