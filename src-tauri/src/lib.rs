mod commands;
mod ssh;

use commands::{
    ime_log_append, ime_log_start, ime_log_stop, ImeLogState,
    ssh_connect, ssh_disconnect, ssh_exec, ssh_resize,
    ssh_test_connection, ssh_write,
};
use commands::{tunnel_start, tunnel_stop};
use ssh::{SshSessionManager, TunnelManager};
use tauri_specta::{collect_commands, collect_events, Builder};

#[cfg(all(debug_assertions, not(mobile)))]
use specta_typescript::Typescript;

use ssh::types::{SshDataPayload, SshDisconnectPayload};

#[derive(Debug, Clone, specta::Type, tauri_specta::Event, serde::Serialize, serde::Deserialize)]
pub struct SshDataEvent(SshDataPayload);

#[derive(Debug, Clone, specta::Type, tauri_specta::Event, serde::Serialize, serde::Deserialize)]
pub struct SshDisconnectEvent(SshDisconnectPayload);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = Builder::<tauri::Wry>::new()
        .commands(collect_commands![
            ime_log_start,
            ime_log_append,
            ime_log_stop,
            ssh_connect,
            ssh_test_connection,
            ssh_write,
            ssh_resize,
            ssh_exec,
            ssh_disconnect,
            tunnel_start,
            tunnel_stop,
        ])
        .events(collect_events![SshDataEvent, SshDisconnectEvent]);

    #[cfg(all(debug_assertions, not(mobile)))]
    builder
        .export(Typescript::default(), "../src/bindings.ts")
        .expect("Failed to export typescript bindings");

    tauri::Builder::default()
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);
            Ok(())
        })
        .manage(SshSessionManager::new())
        .manage(TunnelManager::new())
        .manage(ImeLogState::new())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_log::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
