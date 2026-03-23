# Ad Banner — Feature SSOT

> AdMob + Coupang banner integration for iOS | **Last Updated**: 2026-03-23

## Structure

```
features/ad-banner/
├── model/
│   ├── adBannerStore.ts    — Zustand store (userId, adsEnabled, bannerType, lastShownAt)
│   └── useAdBanner.ts      — ATT → SDK init, cold-start ad, foreground ad, CSS var
├── ui/
│   ├── AdBanner.tsx        — Mounts useAdBanner(); renders AdMob overlay or CoupangBanner
│   ├── CoupangBanner.tsx   — DOM-based Coupang Partners carousel (fallback)
│   └── AdDevPanel.tsx      — DEV-only panel (show/hide/simulate/reset)
├── adapters/api/
│   └── adBannerApi.ts      — Tauri IPC wrappers (admob_request_att, admob_init, banner_show/hide/is_visible)
└── index.ts                — Public API
```

## Architecture

**ATT flow**: `admob_request_att()` → if authorized → AdMob (native UIView); if denied → Coupang (DOM).

```
Cold start / foreground:
  admob_request_att() → "authorized" → admob_init() → admob_banner_show() [GADBannerView]
                      → "denied"    →                  CoupangBanner [DOM script injection]
```

Native UIView approach for AdMob — GADBannerView added to UIWindow above WKWebView via ObjC2 runtime.
React layout shifts via `--ad-banner-h` CSS variable (0px → 50px when banner loads).

## Rust Implementation (`src-tauri/src/commands/admob.rs`)

ObjC2 runtime — no extern "C", no .m bridge needed.

| Command | What it does |
|---------|-------------|
| `admob_request_att` | ATT `requestTrackingAuthorizationWithCompletionHandler:` via `block2::RcBlock`. Returns "authorized"\|"denied"\|"restricted"\|"notDetermined" |
| `admob_init` | `[GADMobileAds sharedInstance] startWithCompletionHandler:nil`. Registers test device via NSArray/NSString ObjC2 runtime |
| `admob_banner_show(adUnitId, userId, safeAreaTop)` | alloc GADBannerView, setAdUnitID, addSubview to UIWindow, loadRequest |
| `admob_banner_hide` | `[banner removeFromSuperview]`, clears BANNER_PTR |
| `admob_banner_is_visible` | checks `static BANNER_PTR: Mutex<Option<usize>>` |

ATT block dropped before `.await` to keep future `Send` (block2::RcBlock is !Send).

## Display Rules

| Trigger | Condition | Action |
|---------|-----------|--------|
| App cold start | `lastShownAt === 0` OR `Date.now() - lastShownAt >= 1h` AND `adsEnabled` | show banner |
| Background → foreground | `Date.now() - lastShownAt >= 1h` AND `adsEnabled` | show banner |
| User disables ads | `adsEnabled = false` | hide banner immediately |
| AdMob SDK not linked | `GADMobileAds class not found` | warn + no-op (graceful) |

**Cooldown**: 1 hour (`BACKGROUND_COOLDOWN_MS = 60 * 60 * 1000` in `adBannerStore.ts`)

## State Store (`adBannerStore.ts`)

| Field | Storage | Default |
|-------|---------|---------|
| `userId` | `localStorage["giterm:user-id"]` | `crypto.randomUUID()` on first launch |
| `adsEnabled` | `localStorage["giterm:ads-enabled"]` | `true` |
| `lastShownAt` | `localStorage["giterm:ad-last-shown"]` | `0` |
| `isBannerVisible` | memory only | `false` |
| `bannerType` | memory only | `"none"` — `"admob" \| "coupang" \| "none"` |

## Ad IDs

| Environment | App ID | Banner Unit ID |
|-------------|--------|----------------|
| DEV (`import.meta.env.DEV`) | Google test (`ca-app-pub-3940256099942544~...`) | `ca-app-pub-3940256099942544/2934735716` |
| Release | `ca-app-pub-5019286268878126~2387220377` | `ca-app-pub-5019286268878126/8296487753` |

Test device ID: `31F5DA0E-DD93-4BF6-AB1D-4FD384E4CC44` (registered in `admob_init` via requestConfiguration)

Debug/Release app ID split: `project.yml settings.base.GAD_APP_ID` (real) vs `settings.configurations.Debug.GAD_APP_ID` (Google test).

## Coupang Banner (`CoupangBanner.tsx`)

DOM-based carousel banner — fallback when ATT denied.
- Dynamically injects `https://ads-partners.coupang.com/g.js` script
- `PartnersCoupang.G({ id: 974809, template: "carousel", trackingCode: "AF6623822", width: "340", height: "50" })`
- Has close (×) button. Script removed on unmount.
- CSP (`tauri.conf.json`): allows `https://ads-partners.coupang.com`, `https://coupa.ng`, `https://link.coupang.com`

## CSS Integration

`useAdBanner()` injects `--ad-banner-h` on `document.documentElement`:
- `50px` when banner loads successfully
- `0px` when hidden or not available

```css
.pt-safe-bar    { padding-top: calc(var(--sat, 0px) + var(--ad-banner-h, 0px)); }
.pt-safe-header { padding-top: calc(var(--sat, 0px) + var(--ad-banner-h, 0px) + 0.25rem); }
```

## iOS Setup

- `Info.plist`: `GADApplicationIdentifier` required (app crashes without it), `NSUserTrackingUsageDescription` required (ATT popup text)
- `SKAdNetworkItems`: `cstr6suwn9.skadnetwork` entry required for attribution
- `Podfile`: `pod 'Google-Mobile-Ads-SDK'` in `giterm_iOS` target
- `Cargo.toml` iOS deps: `block2 = "0.6"` (for ATT RcBlock)
