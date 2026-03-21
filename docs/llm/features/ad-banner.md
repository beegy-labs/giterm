# Ad Banner — Feature SSOT

> AdMob banner slot for mobile terminal view | **Last Updated**: 2026-03-12

## Structure

```
features/ad-banner/
├── model/
│   └── adBannerStore.ts    — Zustand store (isAdLoaded state)
├── ui/
│   └── AdBanner.tsx        — 50px fixed-height banner slot
└── index.ts                — Public API
```

## Architecture

- **Position**: Above `MobileSessionTabBar`, below safe area (inside MobileLayout)
- **Visibility**: `null` when `isAdLoaded=false` (zero height, fully hidden)
- **Height**: 50px (standard mobile banner size)
- **Render condition**: Terminal view only (not shown on ConnectionList screen)

```
MobileLayout (pt-safe-bar)
├── [showConnections] → MobileConnectionList
├── [!showConnections] →
│   ├── AdBanner          ← hidden when no ad loaded
│   ├── MobileSessionTabBar
│   └── terminalView
```

## Integration Status

| Component | Status |
|-----------|--------|
| UI slot (`AdBanner.tsx`) | Done |
| State store (`adBannerStore`) | Done |
| Layout integration (`MobileLayout`) | Done |
| AdMob SDK (Tauri iOS plugin) | Pending |
| Ad unit ID configuration | Pending |
| Revenue tracking | Pending |

## API

```typescript
import { useAdBannerStore } from "@/features/ad-banner";

// Show banner (called after AdMob SDK loads an ad)
useAdBannerStore.getState().setAdLoaded(true);

// Hide banner
useAdBannerStore.getState().setAdLoaded(false);
```

## AdMob Integration Notes (TODO)

- Tauri v2 iOS: Native AdMob SDK via Swift plugin or `with_webview` bridge
- Banner type: `GADBannerView` (adaptive banner, 50pt standard)
- Test ad unit IDs for development
- GDPR/ATT consent required before ad load on iOS
