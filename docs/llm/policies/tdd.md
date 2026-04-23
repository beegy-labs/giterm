# Testing Strategy

> SSOT | **Last Updated**: 2026-03-23 | Classification: Operational

## Methodology: Testing Trophy

Integration-focused, no duplication, clear layer responsibility.

### Layer Responsibility (No Duplication)

| Layer | Verifies | Tool | Anti-Pattern |
|-------|----------|------|-------------|
| **Static** | Types, lint | TypeScript strict, Clippy | Don't test what types already catch |
| **Unit** | Pure function logic | vitest, cargo test | No IPC/UI verification |
| **Integration** | Component + store contracts | vitest + jsdom | No full flow duplication |
| **Manual** | iOS device behavior | Simulator / device | Touch, IME, viewport edge cases |

### Decision Checklist (Before Writing Tests)

```
1. Caught by types (TypeScript strict / tauri-specta)?  → No test needed
2. Pure function? (parser, formatter, validator)         → Unit test
3. Store mutation + selector?                            → Integration (store + selector)
4. React component with user interaction?                → Integration (Testing Library)
5. iOS-specific behavior (touch, IME, viewport)?         → Manual (simulator)
```

---

## Test Purity Principle

**"Function change → only unit breaks → component tests unchanged"**

| Change Type | Unit | Integration | Manual |
|------------|------|-------------|--------|
| Pure function logic | FAIL | PASS | PASS |
| Store mutation behavior | PASS | FAIL | PASS |
| iOS viewport / touch | PASS | PASS | FAIL |

---

## Toolchain

### TypeScript (Frontend)

| Tool | Purpose | Config |
|------|---------|--------|
| vitest | Unit + Integration | jsdom, globals, `src/test/setup.ts` |
| @testing-library/react | Component interaction | userEvent, render |

Test files: co-located `*.test.ts` / `*.test.tsx` next to source.

### Rust (Backend)

| Tool | Purpose |
|------|---------|
| `cargo test` | Unit tests on pure logic (parsing, config building) |
| `cargo check` | Static analysis (no runtime cost) |

`#[cfg(test)]` modules in same file as source. No HTTP or IPC in unit tests.

### Tauri IPC

Type safety via **tauri-specta** — generated `bindings.ts` guarantees FE↔BE contract at compile time. No runtime schema validation needed.

---

## What to Test

| Target | Test Type | Example |
|--------|-----------|---------|
| `koreanImeProcessor.ts` | Unit | `processText()` state machine |
| `connectionStore` selectors | Unit | `selectConnectionById()` |
| `parseServerStats()` | Unit | CPU/mem/disk parsing |
| `isValidPort()`, `classifySshError()` | Unit | Edge cases |
| `ConnectionDialog` form validation | Integration | Invalid input → error message |
| iOS touch / IME / viewport | Manual | Simulator run |

## What NOT to Test

| Avoid | Reason |
|-------|--------|
| Tauri IPC calls in unit tests | Requires running Tauri runtime |
| xterm.js rendering | DOM canvas, not meaningful in jsdom |
| Theme / CSS variables | Visual regression, not logic |
| Types already enforced by TypeScript | Redundant |
