# IME Log — Feature SSOT

> Debug-only IME event file logging | **Last Updated**: 2026-03-04

## Structure

```
features/ime-log/
├── adapters/api/imeLogApi.ts — imeLogStart(), imeLogAppend(), imeLogStop()
└── index.ts
```

## Purpose

Captures Korean IME `beforeinput`/`onChange` events to a file for debugging iOS WKWebView IME issues. Dev builds only.

## Backend (Rust)

- `commands/ime_log.rs`: writes to `$TMPDIR/giterm-ime-{timestamp}.log`
- `ime_log_start`: creates file, stores path in `Mutex<Option<PathBuf>>`
- `ime_log_append`: appends line to file
- `ime_log_stop`: closes file, clears path
- Gated by `#[cfg(debug_assertions)]` compilation

## Log Format

```
[HH:MM:SS.mmm] [IME] BEFOREINPUT: type=deleteContentBackward ...
[HH:MM:SS.mmm] [IME] CHANGE: text=한 ...
```

## Access

```bash
find ~/Library/Developer/CoreSimulator/Devices -name "giterm-ime-*.log" | sort | tail -1
```
