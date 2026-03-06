mod commands;
mod ssh;

use commands::{
    credential_store, credential_get, credential_delete, credential_delete_all,
    ime_log_append, ime_log_start, ime_log_stop, ImeLogState,
    vp_log_append, vp_log_start, vp_log_stop, VpLogState,
    ssh_connect, ssh_disconnect, ssh_exec, ssh_host_key_verify_respond,
    ssh_resize, ssh_test_connection, ssh_write,
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
            credential_store,
            credential_get,
            credential_delete,
            credential_delete_all,
            ime_log_start,
            ime_log_append,
            ime_log_stop,
            vp_log_start,
            vp_log_append,
            vp_log_stop,
            ssh_connect,
            ssh_test_connection,
            ssh_write,
            ssh_resize,
            ssh_exec,
            ssh_disconnect,
            ssh_host_key_verify_respond,
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

            // iOS: Disable WKWebView UIScrollView auto-adjustment on keyboard appearance.
            //
            // When the keyboard appears on iOS, WKWebView's internal UIScrollView
            // automatically scrolls to bring the focused input into view. This shifts
            // the native layout viewport while the WebKit process still computes caret
            // and selection handle coordinates in the pre-scroll coordinate system,
            // causing them to render below the actual input field.
            //
            // Fix: set contentInsetAdjustmentBehavior = .never (3) so WKWebView stops
            // adjusting its scroll position — coordinates stay consistent.
            #[cfg(target_os = "ios")]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    window.with_webview(|wv| {
                        use objc2::msg_send;
                        use objc2::runtime::AnyObject;
                        let wk = wv.inner() as *mut AnyObject;
                        unsafe {
                            let sv: *mut AnyObject = msg_send![wk, scrollView];
                            if !sv.is_null() {
                                let _: () = msg_send![sv, setContentInsetAdjustmentBehavior: 3i64];
                                let _: () = msg_send![sv, setScrollEnabled: false];
                                let _: () = msg_send![sv, setBounces: false];
                            }
                        }
                    }).ok();
                }
            }

            Ok(())
        })
        .manage(SshSessionManager::new())
        .manage(TunnelManager::new())
        .manage(ImeLogState::new())
        .manage(VpLogState::new())
        // shell plugin removed — no shell:allow-open capability needed
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_log::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
