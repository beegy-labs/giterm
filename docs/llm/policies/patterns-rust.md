# Patterns: Rust / Tauri Commands

> SSOT | **Last Updated**: 2026-03-24

## Command Pattern

```rust
// All commands: specta + tauri::command
#[tauri::command]
#[specta::specta]
pub async fn ssh_connect(
    state: tauri::State<'_, AppState>,
    config: ConnectionConfig,
) -> Result<String, String> {
    state.ssh_manager.connect(config).await.map_err(|e| e.to_string())
}
```

## Named Timeout Constants

```rust
const SSH_CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const SSH_CHANNEL_TIMEOUT: Duration = Duration::from_secs(30);

// Never: Duration::from_secs(10) inline
tokio::time::timeout(SSH_CONNECT_TIMEOUT, connect()).await
```

## Error Types — `String` at IPC Boundary

```rust
// String serializes cleanly across IPC; use anyhow internally
pub async fn my_command(...) -> Result<Value, String> {
    internal_logic().await.map_err(|e| e.to_string())
}
```

## Secret Redaction in Debug

```rust
impl fmt::Debug for ConnectionConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ConnectionConfig")
            .field("host", &self.host)
            .field("password", &"[REDACTED]")
            .finish()
    }
}
```

## Structured Concurrency — `JoinSet`

```rust
use tokio::task::JoinSet;

let mut set = JoinSet::new();
set.spawn(async move { session.run().await });
set.spawn(async move { keepalive_loop().await });

while let Some(result) = set.join_next().await {
    result??;
}
// All tasks cancelled when set is dropped

// WRONG — task runs forever, handle ignored
tokio::spawn(async { session.run().await });
```

## Cancellation — `CancellationToken`

```rust
use tokio_util::sync::CancellationToken;

let token = CancellationToken::new();
let child = token.child_token();

tokio::spawn(async move {
    tokio::select! {
        _ = child.cancelled() => { /* cleanup */ }
        result = do_work() => { /* normal completion */ }
    }
});

token.cancel(); // cancels all child tokens
```
