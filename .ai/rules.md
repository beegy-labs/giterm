# Core Development Rules

> CDD Layer 1 | **Last Updated**: 2026-03-24

## Language Policy

ALL code, documentation, and commits MUST be in English.

## Documentation Policy (2-Layer CDD)

| Layer | Path | Purpose |
|-------|------|---------|
| 1 | `.ai/` | Pointers (≤50 lines each) |
| 2 | `docs/llm/` | SSOT (machine-optimized, full detail) |

**CDD-first**: Update `docs/llm/` BEFORE writing code.
**Before coding**: Read `docs/llm/policies/patterns.md` for 2026 patterns.

## NEVER

| Rule | Alternative |
|------|-------------|
| Business logic in UI components | `model/` hooks or `shared/lib/` |
| Tauri IPC calls in UI | `features/*/adapters/api/` only |
| Raw `listen()` in UI | `features/*/adapters/events/` only |
| Inline derived state in store | Export selectors (`selectActiveSession`) |
| `env(safe-area-inset-*)` in CSS | `--sat`/`--sab` vars only |
| `transform` on `position:fixed` MobileLayout | Breaks touch coordinates |
| `display:none` on xterm containers | Drops canvas renderer on iOS |
| Show IP/username/port in UI | Connection name only |
| `any` in TypeScript | `unknown`, discriminated unions, proper types |
| Hardcode timing values (staleTime, debounce ms) | `shared/lib/constants.ts` named constants |
| `onSuccess` for TanStack Query mutations | `onSettled` (runs on error too) |

## ALWAYS

| Rule | Details |
|------|---------|
| Strict TypeScript | `strict: true`, no `any`, `@/` import alias |
| shadcn/ui + Tailwind v4 | `shared/ui/` — never raw HTML equivalents |
| FSD dependency rule | app → pages → widgets → features → entities → shared |
| Tauri commands | `#[specta::specta]` + `#[tauri::command]` |
| `queryOptions()` factory | TanStack Query — SSOT for `queryKey` + `staleTime` |
| `onSettled` for mutations | Invalidate cache on both success and error |
| `refactor` commit type | Use for code restructuring without behavior change |

**SSOT**: `docs/llm/apps/giterm.md`
