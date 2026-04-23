# Git Flow

> Branch & commit strategy | **Last Updated**: 2026-03-24

## Branch Flow

```
feat/* ──────▶ main
```

Single-trunk, direct feature branches. Small team, single production release.

## Commit Format

```
<type>(<scope>): <subject>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`

| Type | When |
|------|------|
| `feat` | New user-facing feature |
| `fix` | Bug fix |
| `refactor` | Code restructuring, no behavior change |
| `docs` | CDD / documentation only |
| `test` | Tests only |
| `chore` | Tooling, deps, build, cleanup |

## iOS Build Number

Format: `YYMMDDHH.N` (UTC). First upload per hour: `.1`. Re-upload same hour: `.2`, `.3`, …
Must be strictly monotonically increasing — App Store Connect rejects lower values.

```bash
date -u +"%y%m%d%H"            # → e.g. 26032414
echo "26032414.1" > .build_number
pnpm tauri ios build
# IPA → src-tauri/gen/apple/build/arm64/giterm.ipa
```

**SSOT**: `docs/llm/apps/giterm.md` → iOS Build section
