mod commands;
mod ssh;

use commands::{
    admob_init, admob_banner_show, admob_banner_hide, admob_banner_is_visible,
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

#[cfg(target_os = "ios")]
#[repr(C)]
#[derive(Copy, Clone)]
struct UIEdgeInsets {
    top: f64,
    left: f64,
    bottom: f64,
    right: f64,
}

#[cfg(target_os = "ios")]
unsafe impl objc2::encode::Encode for UIEdgeInsets {
    const ENCODING: objc2::encode::Encoding = objc2::encode::Encoding::Struct(
        "UIEdgeInsets",
        &[
            objc2::encode::Encoding::Double,
            objc2::encode::Encoding::Double,
            objc2::encode::Encoding::Double,
            objc2::encode::Encoding::Double,
        ],
    );
}

#[cfg(target_os = "ios")]
#[repr(C)]
#[derive(Copy, Clone)]
struct CGPoint {
    x: f64,
    y: f64,
}

#[cfg(target_os = "ios")]
unsafe impl objc2::encode::Encode for CGPoint {
    const ENCODING: objc2::encode::Encoding = objc2::encode::Encoding::Struct(
        "CGPoint",
        &[
            objc2::encode::Encoding::Double,
            objc2::encode::Encoding::Double,
        ],
    );
}

#[cfg(target_os = "ios")]
#[repr(C)]
#[derive(Copy, Clone)]
struct CGSize {
    width: f64,
    height: f64,
}

#[cfg(target_os = "ios")]
unsafe impl objc2::encode::Encode for CGSize {
    const ENCODING: objc2::encode::Encoding = objc2::encode::Encoding::Struct(
        "CGSize",
        &[
            objc2::encode::Encoding::Double,
            objc2::encode::Encoding::Double,
        ],
    );
}

#[cfg(target_os = "ios")]
#[repr(C)]
#[derive(Copy, Clone)]
struct CGRect {
    origin: CGPoint,
    size: CGSize,
}

#[cfg(target_os = "ios")]
unsafe impl objc2::encode::Encode for CGRect {
    const ENCODING: objc2::encode::Encoding = objc2::encode::Encoding::Struct(
        "CGRect",
        &[
            objc2::encode::Encoding::Struct(
                "CGPoint",
                &[
                    objc2::encode::Encoding::Double,
                    objc2::encode::Encoding::Double,
                ],
            ),
            objc2::encode::Encoding::Struct(
                "CGSize",
                &[
                    objc2::encode::Encoding::Double,
                    objc2::encode::Encoding::Double,
                ],
            ),
        ],
    );
}

#[cfg(target_os = "ios")]
fn inject_ios_safe_area(window: tauri::WebviewWindow) {
    use std::{thread, time::Duration};

    const RETRY_DELAYS_MS: [u64; 7] = [0, 16, 50, 100, 250, 500, 1000];

    for delay_ms in RETRY_DELAYS_MS {
        let window = window.clone();
        thread::spawn(move || {
            if delay_ms > 0 {
                thread::sleep(Duration::from_millis(delay_ms));
            }
            let webview_window = window.clone();
            let _ = window.run_on_main_thread(move || {
                let _ = webview_window.with_webview(|wv| {
                    use objc2::runtime::AnyObject;

                    let wk = wv.inner() as *mut AnyObject;
                    unsafe {
                        if let Some((top, bottom)) = read_safe_area_insets(wk) {
                            neutralize_controller_safe_area(wk, top, bottom);
                            apply_viewport_insets(wk, top, bottom);
                            pin_webview_to_window_bounds(wk);
                            apply_safe_area_to_dom(wk, top, bottom);
                        }
                    }
                });
            });
        });
    }
}

#[cfg(target_os = "ios")]
unsafe fn read_safe_area_insets(wk: *mut objc2::runtime::AnyObject) -> Option<(i32, i32)> {
    use objc2::msg_send;
    use objc2::runtime::AnyObject;

    let _: () = msg_send![wk, layoutIfNeeded];

    let insets: UIEdgeInsets = msg_send![wk, safeAreaInsets];
    if insets.top > 0.0 || insets.bottom > 0.0 {
        return Some((insets.top.round() as i32, insets.bottom.round() as i32));
    }

    let window_obj: *mut AnyObject = msg_send![wk, window];
    if window_obj.is_null() {
        return None;
    }

    let window_insets: UIEdgeInsets = msg_send![window_obj, safeAreaInsets];
    if window_insets.top > 0.0 || window_insets.bottom > 0.0 {
        return Some((
            window_insets.top.round() as i32,
            window_insets.bottom.round() as i32,
        ));
    }

    None
}

#[cfg(target_os = "ios")]
unsafe fn apply_safe_area_to_dom(wk: *mut objc2::runtime::AnyObject, top: i32, bottom: i32) {
    use objc2::msg_send;
    use objc2::runtime::AnyObject;

    let js = format!(
        "(function(){{\
            const top={top};\
            const bottom={bottom};\
            const el=document.documentElement;\
            el.style.setProperty('--sat', `${{top}}px`);\
            el.style.setProperty('--sab', `${{bottom}}px`);\
            el.style.setProperty('--vvh-safe-bottom', `${{bottom}}px`);\
            el.dataset.iosSafeAreaReady='true';\
            try {{\
                const cacheKey='giterm:ios-safe-area:v1';\
                const shortEdge=Math.min(window.screen.width, window.screen.height);\
                const longEdge=Math.max(window.screen.width, window.screen.height);\
                const orientation=window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';\
                const slot=`${{shortEdge}}x${{longEdge}}:${{orientation}}`;\
                const raw=window.localStorage.getItem(cacheKey);\
                const cache=raw ? JSON.parse(raw) : {{}};\
                cache[slot]={{ top, bottom }};\
                window.localStorage.setItem(cacheKey, JSON.stringify(cache));\
            }} catch (_err) {{}}\
            window.dispatchEvent(new CustomEvent('giterm:safe-area-ready', {{ detail: {{ top, bottom }} }}));\
        }})();"
    );
    let js_cstr = std::ffi::CString::new(js).unwrap();
    let ns_str: *mut AnyObject = msg_send![
        objc2::class!(NSString),
        stringWithUTF8String: js_cstr.as_ptr()
    ];
    let _: () = msg_send![
        wk,
        evaluateJavaScript: ns_str,
        completionHandler: std::ptr::null::<AnyObject>()
    ];
}

#[cfg(target_os = "ios")]
unsafe fn apply_viewport_insets(wk: *mut objc2::runtime::AnyObject, top: i32, bottom: i32) {
    use objc2::msg_send;

    let viewport_insets = UIEdgeInsets {
        top: top as f64,
        left: 0.0,
        bottom: bottom as f64,
        right: 0.0,
    };
    let _: () = msg_send![
        wk,
        setMinimumViewportInset: viewport_insets,
        maximumViewportInset: viewport_insets
    ];
}

#[cfg(target_os = "ios")]
unsafe fn pin_webview_to_window_bounds(wk: *mut objc2::runtime::AnyObject) {
    use objc2::msg_send;
    use objc2::runtime::AnyObject;

    let window_obj: *mut AnyObject = msg_send![wk, window];
    if window_obj.is_null() {
        return;
    }

    let window_bounds: CGRect = msg_send![window_obj, bounds];
    let _: () = msg_send![wk, setFrame: window_bounds];
    let _: () = msg_send![wk, setBounds: window_bounds];

    let superview: *mut AnyObject = msg_send![wk, superview];
    if !superview.is_null() {
        let _: () = msg_send![superview, setFrame: window_bounds];
        let _: () = msg_send![superview, setBounds: window_bounds];
        let _: () = msg_send![superview, layoutIfNeeded];
    }

    let sv: *mut AnyObject = msg_send![wk, scrollView];
    if !sv.is_null() {
        let _: () = msg_send![sv, setFrame: window_bounds];
        let _: () = msg_send![sv, setBounds: window_bounds];
    }

    let _: () = msg_send![wk, layoutIfNeeded];
}

#[cfg(target_os = "ios")]
unsafe fn neutralize_controller_safe_area(wk: *mut objc2::runtime::AnyObject, top: i32, bottom: i32) {
    use objc2::msg_send;
    use objc2::runtime::AnyObject;

    let window_obj: *mut AnyObject = msg_send![wk, window];
    if window_obj.is_null() {
        return;
    }

    let controller: *mut AnyObject = msg_send![window_obj, rootViewController];
    if controller.is_null() {
        return;
    }

    let compensating_insets = UIEdgeInsets {
        top: -(top as f64),
        left: 0.0,
        bottom: -(bottom as f64),
        right: 0.0,
    };
    let _: () = msg_send![controller, setAdditionalSafeAreaInsets: compensating_insets];
    let _: () = msg_send![controller, setEdgesForExtendedLayout: 15u64];
    let _: () = msg_send![controller, setExtendedLayoutIncludesOpaqueBars: true];

    let view: *mut AnyObject = msg_send![controller, view];
    if !view.is_null() {
        let _: () = msg_send![view, setInsetsLayoutMarginsFromSafeArea: false];
        let _: () = msg_send![view, layoutIfNeeded];
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = Builder::<tauri::Wry>::new()
        .commands(collect_commands![
            admob_init,
            admob_banner_show,
            admob_banner_hide,
            admob_banner_is_visible,
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
                                let zero_insets = UIEdgeInsets {
                                    top: 0.0,
                                    left: 0.0,
                                    bottom: 0.0,
                                    right: 0.0,
                                };
                                let _: () = msg_send![sv, setContentInset: zero_insets];
                                let _: () = msg_send![sv, setScrollIndicatorInsets: zero_insets];
                                let _: () = msg_send![sv, setVerticalScrollIndicatorInsets: zero_insets];
                                let _: () = msg_send![sv, setHorizontalScrollIndicatorInsets: zero_insets];
                                let _: () = msg_send![sv, setAutomaticallyAdjustsScrollIndicatorInsets: false];
                            }
                        }
                    }).ok();
                    inject_ios_safe_area(window);
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
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                use tauri::Manager;
                // Clean up SSH sessions and tunnels
                let ssh = app.state::<SshSessionManager>().inner().clone();
                let tunnels = app.state::<TunnelManager>().inner().clone();
                tauri::async_runtime::block_on(async {
                    tunnels.stop_all().await;
                    ssh.disconnect_all().await;
                });
                // Clean up debug log files (dev only)
                #[cfg(debug_assertions)]
                {
                    app.state::<ImeLogState>().0.cleanup();
                    app.state::<VpLogState>().0.cleanup();
                }
            }
        });
}
