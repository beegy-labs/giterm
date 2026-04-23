# Dependency Upgrade Policy

> SSOT | **Last Updated**: 2026-03-24

## Versioning Strategy

| Semver | Action | Test required |
|--------|--------|---------------|
| Patch (x.y.Z) | Upgrade freely | `pnpm build` + `pnpm test:run` |
| Minor (x.Y.0) | Upgrade, check changelog | Build + tests + manual iOS smoke |
| Major (X.0.0) | Controlled — check breaking changes table below | Full regression |

## Check for Outdated

```bash
# Frontend
pnpm outdated

# Rust
cargo outdated          # requires: cargo install cargo-outdated
cargo outdated --depth 1  # direct deps only
```

## Upgrade Commands

```bash
# Frontend — specific package
pnpm update @tanstack/react-query --latest

# Frontend — all minor/patch
pnpm update

# Rust
cargo update             # updates Cargo.lock to latest compatible
cargo update -p tauri    # single crate
```

## Breaking Change Checklist by Package

### `@tauri-apps/api` / `@tauri-apps/cli`

- `invoke()` signature changes → re-run `pnpm tauri generate` and check `bindings.ts`
- Plugin API changes (store, log) → verify `tauriStorage.ts` and `viewportLogApi.ts`
- iOS build pipeline changes → test `pnpm tauri ios build`

### `react` / `react-dom`

- New concurrent behavior → test all `useEffect` + `useTransition` usages
- `forwardRef` deprecation → React 19 already uses ref-as-prop; watch for removals
- Scheduler changes → test xterm.js rendering on iOS simulator

### `zustand`

- Store initialization API changes → check `create()` call signature
- Middleware API (`persist`, `subscribeWithSelector`) → check `connectionStore`, `adBannerStore`
- Selector behavior → run `pnpm test:run` (store tests)

### `@tanstack/react-query`

- `queryOptions()` API → check all `shared/queries/` files
- `useMutation` signature → check all `onSettled` usages
- Devtools version mismatch → update `@tanstack/react-query-devtools` together

### `@xterm/xterm` + addons

- Canvas/WebGL addon API → check `useTerminalInstances.ts`
- `ITerminalOptions` changes → check `XTerminal` constructor options
- All addons must be updated together (they share xterm peer dependency)

### `tailwindcss` / `@tailwindcss/vite`

- v4 CSS config API changes → check `src/index.css` `@theme` block
- Utility class renames → run `pnpm build` (Tailwind warns on unknown classes)
- `overlay-fullscreen`, `pt-safe-*` custom utilities → check `src/index.css`

### `tauri` (Rust crate)

- Command macro changes → run `cargo check`
- iOS build target → test `pnpm tauri ios build` end-to-end
- `objc2` / `block2` changes → check `src-tauri/src/commands/admob.rs`

## After Every Upgrade

```bash
# 1. Build
pnpm build

# 2. TypeScript check
pnpm tsc --noEmit

# 3. Tests
pnpm test:run

# 4. Rust
cargo check --manifest-path src-tauri/Cargo.toml

# 5. Manual iOS smoke (for Tauri/xterm/React upgrades)
(echo 9; sleep 600) | pnpm tauri ios dev
# Verify: terminal renders, keyboard resize works, ad banner loads
```

## Pinning Rules

| Package | Pin? | Reason |
|---------|------|--------|
| `@xterm/xterm` + addons | Lockstep (all same version) | Peer dep coupling |
| `tauri` + `tauri-plugin-*` | Same major | Plugin ABI |
| `react` + `react-dom` | Always same version | Required |
| Everything else | SemVer range (`^`) | Auto patch/minor OK |

## Cadence

- **Patch/minor**: When needed or quarterly sweep
- **Major**: Intentional — schedule time for breaking changes, update CDD after
