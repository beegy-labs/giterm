# Rules — giterm

> Core development rules | **Last Updated**: 2026-02-20

## Frontend Architecture (FSD + Hexagonal Adapters)

| Rule | Detail |
|------|--------|
| Pattern | FSD layers + Hexagonal segment roles |
| Dependencies | app → pages → widgets → features → entities → shared |
| No cross-import | Features cannot import other features |
| API in adapters | API calls via `features/*/adapters/api/`, never in UI |
| Biz logic in model | State/hooks in `model/`, not in UI components |
| index.ts | Every feature/entity/widget must export via `index.ts` |

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
| State | Zustand (entities/features), TanStack Query (async) |

## Rust

| Rule | Detail |
|------|--------|
| Commands | `#[specta::specta]` + `#[tauri::command]` |
| SSH | russh 0.57 async, tokio runtime |
| Data flow | Tauri events for server→client, commands for client→server |

## IME Logging (Dev Only)

| Rule | Detail |
|------|--------|
| Auto-start | Dev 빌드에서 컴포넌트 마운트 시 자동으로 파일 로그 시작 |
| 파일 위치 | iOS 시뮬레이터 샌드박스 `/tmp/giterm-ime-YYYYMMDD-HHMMSS.log` |
| 포맷 | `[HH:MM:SS.mmm] [IME] ...` (타임스탬프 자동 prefix) |
| 화면 오버레이 | **금지** — 파일 기반만 사용 |
| On/Off 버튼 | **없음** — dev 빌드에서 항상 ON |
| 로그 확인 | `find ~/Library/Developer/CoreSimulator/Devices -name "giterm-ime-*.log" \| sort \| tail -1` |

## Commits

| Format | Example |
|--------|---------|
| Convention | `feat:`, `fix:`, `chore:`, `docs:` |
