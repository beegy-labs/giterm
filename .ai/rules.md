# Rules — giterm

> Core development rules | **Last Updated**: 2026-03-04

## Frontend Architecture (FSD + Hexagonal)

| Rule | Detail |
|------|--------|
| Pattern | FSD layers + Hexagonal segment roles |
| Dependencies | app → pages → widgets → features → entities → shared |
| No cross-import | Features cannot import other features (shared logic → `shared/lib/`) |
| API in adapters | API calls via `features/*/adapters/api/`, never in UI |
| Events in adapters | Tauri `listen()` via `features/*/adapters/events/`, never in UI |
| Biz logic in model | State/hooks in `model/`, not in UI components |
| Selectors | Derived state via exported selectors (e.g. `selectActiveSession`), not store getters. Every module exports via `index.ts` |

## Design System (Midnight Gentle Study)

| Rule | Detail |
|------|--------|
| WCAG AAA | 7:1+ contrast ratio for all text |
| 8pt grid | All spacing multiples of 8px |
| Radius | 4px default (terminal style) |
| Privacy | NEVER show IP/username/port in UI |
| Minimal | Icon-only buttons, whitespace-embracing |

## TypeScript

| Rule | Detail |
|------|--------|
| Strict mode | `strict: true`, no `any` |
| Imports | `@/` alias for `src/` |
| Components | shadcn/ui (`shared/ui/`) + Tailwind CSS v4 |
| State | Zustand (entities/features), TanStack Query (`queryOptions()` factory in `shared/queries/`) |
| Error | `ErrorBoundary` wraps app root (class component, React 19) |

## Rust

| Rule | Detail |
|------|--------|
| Commands | `#[specta::specta]` + `#[tauri::command]` |
| SSH | russh 0.57 async, tokio runtime |
| Data flow | Tauri events for server→client, commands for client→server |

## Dev & Commits

| Rule | Detail |
|------|--------|
| Dev logging | File-based only (`/tmp/giterm-ime-*.log`, `/tmp/giterm-vp-*.log`), no screen overlay |
| Commits | `feat:`, `fix:`, `chore:`, `docs:` |
