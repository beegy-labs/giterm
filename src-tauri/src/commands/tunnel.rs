use tauri::State;

use crate::ssh::{SshSessionManager, TunnelManager};

#[tauri::command]
#[specta::specta]
pub async fn tunnel_start(
    tunnel_id: String,
    session_id: String,
    local_port: u16,
    remote_host: String,
    remote_port: u16,
    ssh_state: State<'_, SshSessionManager>,
    tunnel_state: State<'_, TunnelManager>,
) -> Result<(), String> {
    let handle = ssh_state.get_handle(&session_id).await?;
    tunnel_state
        .start_tunnel(tunnel_id, handle, local_port, remote_host, remote_port)
        .await
}

#[tauri::command]
#[specta::specta]
pub async fn tunnel_stop(
    tunnel_id: String,
    tunnel_state: State<'_, TunnelManager>,
) -> Result<(), String> {
    tunnel_state.stop_tunnel(&tunnel_id).await
}
