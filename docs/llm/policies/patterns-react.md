# Patterns: React 19

> SSOT | **Last Updated**: 2026-03-24

## `use()` Hook — Conditional Context / Promise

```typescript
import { use } from 'react'

// Can be called inside conditionals (unlike useContext)
function Heading({ children }: { children?: ReactNode }) {
  if (!children) return null
  const theme = use(ThemeContext) // inside conditional — OK
  return <h1 style={{ color: theme.color }}>{children}</h1>
}
```

## `useActionState` — Async Action State

```typescript
import { useActionState } from 'react'

const [error, submitAction, isPending] = useActionState(
  async (_prev: string | null, formData: FormData) => {
    const err = await updateSetting(formData.get('key') as string)
    return err ?? null
  },
  null,
)
```

## ref as Prop (No `forwardRef`)

```typescript
// React 19: ref is a regular prop
function Input({ ref, ...props }: React.ComponentProps<'input'>) {
  return <input ref={ref} {...props} />
}
```

## ref Cleanup Function

Useful for xterm.js lifecycle:

```typescript
<div
  ref={(el) => {
    if (!el) return
    const term = new Terminal()
    term.open(el)
    return () => term.dispose() // called on unmount
  }}
/>
```

## `<Context>` as Provider

```typescript
// React 19 — no .Provider wrapper needed
<ThemeContext value="dark">{children}</ThemeContext>
```

## `useOptimistic` for Toggle Mutations

```typescript
const [optimisticEnabled, setOptimistic] = useOptimistic(
  adsEnabled,
  (_, newValue: boolean) => newValue,
)

const mutation = useMutation({
  mutationFn: (v: boolean) => setAdsEnabled(v),
  onError: () => setOptimistic(adsEnabled), // revert on error
})

<Switch
  checked={optimisticEnabled}
  onCheckedChange={(v) => { setOptimistic(v); mutation.mutate(v) }}
/>
```

## `useTransition` for Non-Urgent Updates

```typescript
const [isPending, startTransition] = useTransition()
const handleTabSwitch = (index: number) => {
  startTransition(() => setActiveIndex(index))
}
```

## Avoid Unnecessary Memo

React 19 compiler handles most cases. Apply `useMemo` only for:
- Expensive filter/sort/map on large datasets
- Values used as `useEffect` deps that would cause loops

```typescript
// Needed
const sorted = useMemo(() => connections.slice().sort(...), [connections])

// Not needed
const name = connection.name
```
