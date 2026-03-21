# App Lifecycle — Feature SSOT

> App startup, exit cleanup, resource management | **Last Updated**: 2026-03-12

## Exit Cleanup

**File**: `src-tauri/src/lib.rs`

On `RunEvent::Exit`, the app performs ordered cleanup:

```rust
.build(tauri::generate_context!())
.run(|app, event| {
    if let tauri::RunEvent::Exit = event {
        // 1. Stop all SSH tunnels
        tunnels.stop_all().await;
        // 2. Disconnect all SSH sessions
        ssh.disconnect_all().await;
        // 3. Delete debug log files (dev only)
        app.state::<ImeLogState>().0.cleanup();
        app.state::<VpLogState>().0.cleanup();
    }
});
```

## Resource Lifecycle

| Resource | Created | Cleaned Up | Location |
|----------|---------|------------|----------|
| SSH sessions | `ssh_connect` | `disconnect_all()` on exit | `ssh/session.rs` |
| SSH tunnels | `tunnel_start` | `stop_all()` on exit | `ssh/tunnel.rs` |
| IME log files | `ime_log_start` (dev) | `cleanup()` on exit | `commands/ime_log.rs` |
| VP log files | `vp_log_start` (dev) | `cleanup()` on exit | `commands/viewport_log.rs` |
| xterm.js instances | Tab creation | `terminal.dispose()` on session close | `useTerminalInstances.ts` |
| TanStack Query cache | Session connect | `removeQueries()` on close | `closeSession.ts` |
| CPU snapshot cache | First stats poll | `clearCpuSnapshot()` on close | `cpuSnapshotCache.ts` |

## Key Methods

| Method | Struct | Purpose |
|--------|--------|---------|
| `disconnect_all()` | `SshSessionManager` | Iterates all sessions, calls `disconnect()` each |
| `stop_all()` | `TunnelManager` | Iterates all tunnels, calls `stop_tunnel()` each |
| `cleanup()` | `DebugLogManager` | Deletes `/tmp/giterm-*.log` file if active |

Both `SshSessionManager` and `TunnelManager` derive `Clone` for access in the `RunEvent` handler.

## iOS-Specific

- `setContentInsetAdjustmentBehavior: .never` — set once during `setup()` (Layer 1)
- `setScrollEnabled: false` + `setBounces: false` — prevents UIScrollView interference
- Debug log files are in `/tmp/` — cleaned on exit, but survive crash
