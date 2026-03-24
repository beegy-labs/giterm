# Code Review

> CDD Layer 1 — Review checklist pointer | **Last Updated**: 2026-03-24

## Before Reviewing

Read `docs/llm/policies/patterns.md` — the authoritative 2026 patterns reference.

## Checklist

### Architecture
- [ ] FSD dependency rule respected (no features importing features)
- [ ] IPC calls only in `adapters/api/`, events only in `adapters/events/`
- [ ] Business logic in `model/`, not in UI components
- [ ] Selectors exported from store, not derived inline in components

### TypeScript
- [ ] No `any` — use `unknown`, discriminated unions, or proper types
- [ ] Error boundaries: `catch (err: unknown)` + `String(err)` or `instanceof Error`
- [ ] New shared types in `shared/lib/types.ts`, not local `type Foo = ...`

### TanStack Query
- [ ] `queryOptions()` factory used (not inline query config)
- [ ] `onSettled` for mutations (not `onSuccess`)
- [ ] Timing values from `shared/lib/constants.ts` (not hardcoded ms)

### Zustand
- [ ] Selectors are exported named functions, not inline arrows
- [ ] Object/array selectors wrapped with `useShallow` (Zustand 5 — no `useShallow` = infinite loop)
- [ ] `partialize` strips secrets before persistence
- [ ] Outside React: use `useStore.getState()` / `.setState()`

### iOS Safety
- [ ] No `env(safe-area-inset-*)` — use `--sat`/`--sab`
- [ ] No `transform` on `position:fixed` MobileLayout
- [ ] No `display:none` on xterm containers — use `visibility:hidden`
- [ ] Dialog centering uses `--vvh` (not `--app-h`)

### Rust / Tauri
- [ ] Commands have `#[specta::specta]` + `#[tauri::command]`
- [ ] Timeouts use named `Duration` constants, not `from_secs(N)` literals
- [ ] Secret fields redacted in `Debug` impl
- [ ] `Result<T, String>` at IPC boundary, `anyhow` internally

### Battery / Mobile (iOS)
- [ ] Polling queries have `refetchIntervalInBackground: false` (explicit)
- [ ] `setInterval` / manual polling guarded by `document.visibilityState === "visible"`
- [ ] SSH sessions NOT disconnected on `visibilitychange → hidden` (Rust keepalive handles it)
- [ ] New `visibilitychange` handler follows hide→snapshot / show→reconnect pattern

**Full battery policy**: `docs/llm/policies/battery-mobile.md`

### Privacy
- [ ] No IP/username/port rendered in UI — connection name only

**Full patterns**: `docs/llm/policies/patterns.md`
