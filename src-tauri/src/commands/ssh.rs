use tauri::{AppHandle, State};

use crate::ssh::{ConnectionConfig, SshSessionManager};

#[tauri::command]
#[specta::specta]
pub async fn ssh_connect(
    config: ConnectionConfig,
    state: State<'_, SshSessionManager>,
    app: AppHandle,
) -> Result<String, String> {
    state.connect(config, app).await
}

#[tauri::command]
#[specta::specta]
pub async fn ssh_write(
    session_id: String,
    data: Vec<u8>,
    state: State<'_, SshSessionManager>,
) -> Result<(), String> {
    state.write(&session_id, &data).await
}

#[tauri::command]
#[specta::specta]
pub async fn ssh_resize(
    session_id: String,
    cols: u32,
    rows: u32,
    state: State<'_, SshSessionManager>,
) -> Result<(), String> {
    state.resize(&session_id, cols, rows).await
}

#[tauri::command]
#[specta::specta]
pub async fn ssh_disconnect(
    session_id: String,
    state: State<'_, SshSessionManager>,
) -> Result<(), String> {
    state.disconnect(&session_id).await
}
