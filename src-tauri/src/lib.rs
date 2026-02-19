mod commands;
mod ssh;

use commands::{ssh_connect, ssh_disconnect, ssh_resize, ssh_write};
use ssh::SshSessionManager;
use tauri_specta::{collect_commands, collect_events, Builder};
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
            ssh_connect,
            ssh_write,
            ssh_resize,
            ssh_disconnect,
        ])
        .events(collect_events![SshDataEvent, SshDisconnectEvent]);

    #[cfg(debug_assertions)]
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
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_log::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
