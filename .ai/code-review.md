# Code Review

> CDD Layer 1 — Checklist pointer | **Last Updated**: 2026-03-24

Read `docs/llm/policies/patterns.md` before reviewing.

## Checklist

### Architecture
- [ ] FSD rule: no features importing features
- [ ] IPC only in `adapters/api/`, events only in `adapters/events/`
- [ ] Business logic in `model/`, not UI

### TypeScript
- [ ] No `any` — use `unknown` or discriminated unions
- [ ] `catch (err: unknown)` explicit annotation

### TanStack Query
- [ ] `queryOptions()` factory (not inline config for reused queries)
- [ ] `onSettled` for cache invalidation (not `onSuccess`)
- [ ] Timing from `constants.ts` (not hardcoded ms)

### Zustand
- [ ] Object/array selectors wrapped with `useShallow`
- [ ] `partialize` strips secrets before persistence

### iOS Safety
- [ ] No `env(safe-area-inset-*)` — use `--sat`/`--sab`
- [ ] No `transform` on `position:fixed` layout
- [ ] No `display:none` on xterm — use `visibility:hidden`
- [ ] Dialog centering uses `--vvh` (not `--app-h`)

### Battery / Mobile
- [ ] Polling queries have `refetchIntervalInBackground: false`
- [ ] SSH sessions NOT disconnected on `visibilitychange → hidden`

### Rust / Tauri
- [ ] Commands have `#[specta::specta]` + `#[tauri::command]`
- [ ] Timeouts use named `Duration` constants
- [ ] `Result<T, String>` at IPC boundary

### Privacy
- [ ] No IP/username/port in UI — connection name only
