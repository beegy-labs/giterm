# Battery & Mobile Optimization Policy

> SSOT | **Last Updated**: 2026-03-24
> iOS (Tauri WKWebView) — SSH Terminal Client

---

## iOS Background Execution Model

Tauri on iOS = WKWebView (JS) + Rust native process in a single app bundle.

| Phase | JS (WKWebView) | Rust Process | SSH TCP Socket |
|-------|----------------|--------------|----------------|
| Foreground | Running ✅ | Running ✅ | Active ✅ |
| Background (0–30s) | **Suspended** ⏸ | Running ~30s | Active ✅ |
| Background (>30s) | Suspended ⏸ | **Suspended** ⏸ | OS-managed (may drop) |
| Foreground resume | Resumes ✅ | Resumes ✅ | Check needed |

**Key constraint**: iOS suspends the entire app process after ~30s in background.
SSH keepalives (Rust side) only fire during the brief ~30s window.

---

## SSH Session — Keepalive Strategy

### Current settings (`src-tauri/src/ssh/session.rs`)

```rust
const SSH_INACTIVITY_TIMEOUT: Duration = Duration::from_secs(600);  // 10 min
const SSH_KEEPALIVE_INTERVAL: Duration = Duration::from_secs(15);   // every 15s
const SSH_KEEPALIVE_MAX: usize = 3;                                  // 3 failures → disconnect
```

### Why 15s interval

- **Server timeout**: Most SSH servers disconnect after 60–120s of silence
- **iOS window**: App gets ~30s in background → 2 keepalives before suspension
- **Battery cost**: One TCP keepalive packet = ~100 bytes → negligible
- **DO NOT increase interval** — longer intervals risk server-side disconnection

### Session lifetime expectations

| Scenario | Result |
|----------|--------|
| Background < 30s | SSH alive (keepalives sent) |
| Background 30s–10min | SSH may survive (OS kernel keeps socket) |
| Background > 10min | SSH likely dropped (server timeout) |
| App suspended then resumed | Check connection; auto-reconnect if needed |

### Auto-reconnect on foreground

`useAutoReconnect()` (registered in `App.tsx`) handles this:

1. On `visibilitychange → hidden`: snapshot "connected" session IDs
2. On `visibilitychange → visible`: reconnect sessions that became "disconnected"
3. Only reconnects sessions that were connected **before** the app was backgrounded
   — intentional user disconnects are NOT auto-reconnected

```
File: src/features/ssh-connect/model/useAutoReconnect.ts
```

**NEVER** disconnect or invalidate SSH sessions on `visibilitychange → hidden`.
The session should stay alive as long as possible (Rust keepalive handles it).

---

## Polling — Stop in Background

### Rule: `refetchIntervalInBackground: false` on all polling queries

TanStack Query pauses `refetchInterval` when the document is not visible.
Always set explicitly to document the intent:

```typescript
// src/features/server-monitor/model/useServerStats.ts
export const serverStatsQuery = (sessionId: string) =>
  queryOptions({
    queryKey: ["serverStats", sessionId],
    queryFn: () => fetchServerStats(sessionId),
    staleTime: STALE_TIME_FAST,
    refetchInterval: REFETCH_INTERVAL_FAST,
    refetchIntervalInBackground: false,  // ← always explicit
    retry: false,
    enabled: !!sessionId,
  });
```

**Effect**: When iOS backgrounds the app and WKWebView suspends, the polling
interval is already paused at the JS level before suspension begins.

### refetchOnWindowFocus (default: true)

TanStack Query refetches stale queries when the window regains focus.
This is **desirable**: server stats refresh immediately when user switches back to the app.
Do NOT disable `refetchOnWindowFocus` on server stats queries.

---

## Polling Intervals — Design Rules

| Interval | Use Case | Battery Impact |
|----------|----------|----------------|
| ≤ 5s | Real-time stats (foreground only) | Low (paused in background) |
| 5–30s | Semi-real-time | Low |
| > 30s | Historical / audit data | Very low |
| `Infinity` staleTime | Static config / one-time data | None |

Never use `refetchInterval` < 3s — too aggressive even in foreground.

---

## UI — Background-Aware Patterns

### Do NOT trigger UI work in background

```typescript
// WRONG — fires even when app is backgrounded
useEffect(() => {
  const interval = setInterval(doWork, 5000);
  return () => clearInterval(interval);
}, []);

// CORRECT — guard with visibility check
useEffect(() => {
  const interval = setInterval(() => {
    if (document.visibilityState === "visible") doWork();
  }, 5000);
  return () => clearInterval(interval);
}, []);
```

### visibilitychange for one-time foreground actions

```typescript
useEffect(() => {
  const handle = () => {
    if (document.visibilityState === "visible") {
      doOnForeground();
    }
  };
  document.addEventListener("visibilitychange", handle);
  return () => document.removeEventListener("visibilitychange", handle);
}, [deps]);
```

---

## What NOT to Do (iOS Policy Boundaries)

| Action | Status | Reason |
|--------|--------|--------|
| Background audio for keepalive | ❌ Rejected | App Store guideline 2.5.4 — silent audio is rejected |
| VoIP push to wake app | ⚠️ Complex | Requires server-side push infra, PushKit entitlement |
| Location background mode | ❌ N/A | Not relevant to SSH terminal |
| `URLSession` background transfers | ❌ N/A | Rust uses TCP directly, not URLSession |
| Increase keepalive > 60s | ❌ Risky | Server disconnects before next keepalive |

**Accepted limitation**: If the iOS process is suspended for > ~10min, SSH sessions
will drop. The correct response is seamless auto-reconnect on foreground resume.

---

## Checklist for New Polling Features

- [ ] `refetchIntervalInBackground: false` set explicitly
- [ ] Interval ≥ 3s (never sub-second polling)
- [ ] `enabled` gated on valid data (not polling with undefined session)
- [ ] `staleTime: Infinity` if data doesn't change (connection config, user prefs)
- [ ] `retry: false` for SSH exec queries (errors are shown to user, not retried silently)
