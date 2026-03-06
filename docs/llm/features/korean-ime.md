# Korean IME Input — Architecture

> Terminal IME for iOS WKWebView | **Last Updated**: 2026-03-04

## iOS Korean IME Quirks

- `compositionstart/update/end` NEVER fire — `isComposing` always false
- Every keystroke during composition fires a **delete+insert pair**:
  1. `beforeinput(deleteContentBackward)` — removes previous partial char
  2. `beforeinput(insertText)` — inserts new combined char
- `input.value` assignment via script is NOT reflected in IME buffer

> **CRITICAL**: `setTimeout(0)` fires BETWEEN the pair events → spurious backspaces. Never use.

## Architecture

```
HiddenImeInput (<input>) → koreanImeProcessor → ImeAction[] → sshWrite
     ↑ focus (tap)                                  ↓
  Terminal touch                        commit / composing / backspace
     ↓ beforeinput                                  ↓
  delete+insert detection              resetField() — input.value="" only
```

**Single input, no focus movement.** iOS first responder never changes.

## Key Files

| File | Purpose |
|------|---------|
| `src/widgets/terminal-view/ui/HiddenImeInput.tsx` | DOM events, resetField |
| `src/shared/lib/koreanImeProcessor.ts` | Pure logic: text → ImeAction[] |
| `src/shared/lib/koreanIme.ts` | Korean char utilities (SSOT) |

## Why Single Input (not Dual-Field)

Dual-field used `blur() + focus()` to alternate between two inputs. **Fatal on iOS WKWebView**:
`focus()` inside a `beforeinput` handler does NOT immediately transfer iOS first responder.
iOS finishes the current event on the original element — new input receives nothing.

Confirmed via IME log: 17+ second delay after swap, or permanently dead input.
User symptom: "삭제 후 입력이 안 됨 / 포커스 유실"

**Fix**: single input. `input.value = ""` clears the composition buffer. No focus movement.

## resetField

```ts
// Called in place of swapField(). No blur/focus.
needsResetRef.current = false;
expectingInsertRef.current = false;
resetImeState(); // outputted="", composing="", lastText=""
input.value = "";
```

`koreanImeProcessor` still emits `{ type: "swap" }` — `HiddenImeInput` handles it as `resetField()`.

## beforeinput Handling

```
deleteContentBackward:
  1. needsResetRef? → resetField() + preventDefault
  2. composing="" AND value=""? → bare backspace + preventDefault
  3. else → expectingInsert=true, start 50ms fallback timer

insertText / insertCompositionText:
  1. needsResetRef? → resetField() — do NOT return, let insert proceed
                      → iOS inserts into empty field → onChange fires with new char only
  2. expectingInsert? → clear flag, cancel timer (pair complete)

onChange:
  1. needsResetRef? → resetField() (fallback if beforeinput was skipped)
  2. expectingInsert=true AND text is prefix of lastText → SKIP (delete half)
  3. processText(state, text) → ImeAction[]
```

## processText — ImeAction Types

| Action | Effect |
|--------|--------|
| `commit(char)` | Send char to terminal via sshWrite |
| `composing(text)` | Update ComposingOverlay |
| `backspace` | Send ESC backspace sequence |
| `swap` | → `resetField()` in HiddenImeInput |

**Safe commit**: Last Korean char may still change (vowel/consonant addition).
Commit only up to `charCount - 1` chars. All chars safe when last char is non-Korean.

## Reset Policy

- `beforeinput(insertText)` + `needsResetRef` → `resetField()` then continue
- `beforeinput(delete)` + `needsResetRef` → `resetField()` + preventDefault
- 50ms fallback timer → set `needsResetRef=true` only (deferred)
- Enter / toolbar backspace with composing → `resetField()` directly
- onChange fallback → `resetField()` if beforeinput missed

## Debug

Dev only: `find ~/Library/Developer/CoreSimulator/Devices -name "giterm-ime-*.log" | sort | tail -1`
See `docs/llm/features/ime-log.md` for log format details.
