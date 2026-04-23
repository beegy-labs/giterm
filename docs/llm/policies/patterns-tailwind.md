# Patterns: Tailwind CSS v4

> SSOT | **Last Updated**: 2026-03-24

## CSS Variable Tokens (`@theme`)

Config in CSS, not `tailwind.config.js`:

```css
/* src/index.css */
@theme {
  --color-primary: #10B981;
  --color-background: #0B0E0C;
}
```

## Semantic Utility Classes

```tsx
// CORRECT — uses theme token
<div className="bg-primary text-primary-foreground" />

// WRONG — bypasses theme
<div style={{ backgroundColor: '#10B981' }} />
<div className="bg-emerald-500" />
```

## `overlay-fullscreen` — Fixed Overlay

```tsx
// Backdrop — uses --app-h (never shrinks with keyboard)
<div className="overlay-fullscreen z-50 bg-black/50" />

// Dialog centering — uses --vvh (re-centers when keyboard appears)
<div
  className="overlay-fullscreen z-50 flex items-center justify-center"
  style={{ height: 'var(--vvh, var(--app-h, 100vh))' }}
/>
```

## Mobile Safe Area

```tsx
// CORRECT — individual headers only
<header className="pt-safe-bar">...</header>

// WRONG — never on layout containers
<div className="overlay-fullscreen pt-safe-bar">...</div>

// CORRECT — CSS variable, not env() directly
style={{ top: 'var(--sat, 0px)' }}

// WRONG
style={{ top: 'env(safe-area-inset-top, 0px)' }}
```

## iOS Variable Reference

| Variable | Source | Use |
|----------|--------|-----|
| `--sat` | Rust → JS | Safe area top |
| `--sab` | Rust → JS | Safe area bottom |
| `--vvh` | `useVisualViewport` | Visible height (shrinks with keyboard) |
| `--app-h` | `useVisualViewport` | Full app height (never shrinks) |
| `--ad-banner-h` | Ad banner | Banner reservation |
