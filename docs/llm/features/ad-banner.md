# Ad Banner — Feature SSOT

> AdMob banner integration for iOS | **Last Updated**: 2026-03-22

## Structure

```
features/ad-banner/
├── model/
│   ├── adBannerStore.ts    — Zustand store (userId, adsEnabled, lastShownAt)
│   └── useAdBanner.ts      — SDK init, cold-start ad, foreground ad, CSS var
├── ui/
│   ├── AdBanner.tsx        — Mounts useAdBanner(); returns null (native UIView)
│   ├── AdToggle.tsx        — Inline toggle button (ads on/off indicator)
│   └── AdDevPanel.tsx      — DEV-only panel (show/hide/simulate/reset)
├── adapters/api/
│   └── adBannerApi.ts      — Tauri IPC wrappers (admob_init, banner_show/hide/is_visible)
└── index.ts                — Public API
```

## Architecture

Native UIView approach — no DOM element. GADBannerView is created in Rust via objc2
runtime calls and added directly to UIWindow above WKWebView. React layout shifts via
`--ad-banner-h` CSS variable (0px → 50px when ad loads).

```
UIWindow
├── WKWebView (React app)
│   └── MobileLayout
│       ├── [showConnections] → MobileConnectionList
│       └── [!showConnections] →
│           ├── MobileSessionTabBar (pt-safe-bar includes --ad-banner-h)
│           └── TerminalView
└── GADBannerView (native, y = safeAreaTop, h = 50px)   ← above WKWebView
```

## Rust Implementation

`src-tauri/src/commands/admob.rs` — ObjC2 runtime (no extern "C", no .m bridge needed):

| Command | What it does |
|---------|-------------|
| `admob_init` | `[GADMobileAds sharedInstance] startWithCompletionHandler:nil` |
| `admob_banner_show(adUnitId, userId, safeAreaTop)` | alloc GADBannerView, setAdUnitID, addSubview to UIWindow, loadRequest |
| `admob_banner_hide` | `[banner removeFromSuperview]`, clears BANNER_PTR |
| `admob_banner_is_visible` | checks static `BANNER_PTR: Mutex<Option<usize>>` |

Banner pointer stored as `static BANNER_PTR: Mutex<Option<usize>>` (usize = raw pointer).
UIWindow holds strong ref; BANNER_PTR is just a handle for `removeFromSuperview`.

## Display Rules

| Trigger | Condition | Action |
|---------|-----------|--------|
| App cold start | `lastShownAt === 0` AND `adsEnabled` | show banner |
| Background → foreground | `Date.now() - lastShownAt >= 4h` AND `adsEnabled` | show banner |
| User disables ads | `adsEnabled = false` | hide banner immediately |
| AdMob SDK not linked | `GADMobileAds class not found` | warn + no-op (graceful) |

## State Store (`adBannerStore.ts`)

| Field | Storage | Default |
|-------|---------|---------|
| `userId` | `localStorage["giterm:user-id"]` | `crypto.randomUUID()` on first launch |
| `adsEnabled` | `localStorage["giterm:ads-enabled"]` | `true` |
| `lastShownAt` | `localStorage["giterm:ad-last-shown"]` | `0` |
| `bannerVisible` | memory only | `false` |

## CSS Integration

`useAdBanner()` injects `--ad-banner-h` on `document.documentElement`:
- `50px` when banner loads successfully
- `0px` when hidden or not available

`src/index.css` utilities include `--ad-banner-h` in padding:
```css
.pt-safe-bar    { padding-top: calc(var(--sat, 0px) + var(--ad-banner-h, 0px)); }
.pt-safe-header { padding-top: calc(var(--sat, 0px) + var(--ad-banner-h, 0px) + 0.25rem); }
```

## iOS Setup

- `Info.plist`: `GADApplicationIdentifier` required (app crashes without it)
- `SKAdNetworkItems`: `cstr6suwn9.skadnetwork` entry required for attribution
- `Podfile`: `pod 'Google-Mobile-Ads-SDK'` in `giterm_iOS` target
- Current IDs: test IDs — replace before production release

## AdDevPanel (DEV only)

Shown when `import.meta.env.DEV`. Buttons: init SDK, show/hide banner, CSS simulate
toggle, enable/disable ads, reset cooldown. Rolling log of last 10 actions + live state
display (userId, adsEnabled, lastShownAt, --ad-banner-h value).
