/// AdMob banner commands — iOS only.
///
/// Uses ObjC2 runtime to call GADMobileAds / GADBannerView at runtime.
/// No extern "C" bridge needed — the framework is linked via CocoaPods.
///
/// Layout: native GADBannerView is added to UIWindow at y=safeAreaTop.
/// The React app shifts via --ad-banner-h CSS variable (injected via JS).

#[cfg(target_os = "ios")]
use std::sync::Mutex;

/// Raw banner pointer stored as usize (raw pointers are not Send).
/// UIWindow holds a strong ref; this is just a handle for removeFromSuperview.
#[cfg(target_os = "ios")]
static BANNER_PTR: Mutex<Option<usize>> = Mutex::new(None);

#[tauri::command]
#[specta::specta]
pub fn admob_init() {
    #[cfg(target_os = "ios")]
    unsafe {
        use objc2::runtime::{AnyClass, AnyObject};
        use objc2::msg_send;

        let Some(cls) = AnyClass::get(c"GADMobileAds") else {
            log::warn!("[AdMob] GADMobileAds class not found — SDK not linked");
            return;
        };
        let shared: *mut AnyObject = msg_send![cls, sharedInstance];
        if shared.is_null() { return; }
        let _: () = msg_send![shared, startWithCompletionHandler: std::ptr::null::<AnyObject>()];
        log::info!("[AdMob] SDK init requested");
    }
}

#[tauri::command]
#[specta::specta]
pub async fn admob_banner_show(
    window: tauri::WebviewWindow,
    ad_unit_id: String,
    user_id: String,
    safe_area_top: f64,
) -> Result<(), String> {
    #[cfg(target_os = "ios")]
    {
        let window_inner = window.clone();
        window
            .run_on_main_thread(move || {
                let _ = window_inner.with_webview(move |wv| {
                    use objc2::runtime::{AnyClass, AnyObject};
                    use objc2::msg_send;
                    use std::ffi::CString;

                    let Some(banner_cls) = AnyClass::get(c"GADBannerView") else {
                        log::warn!("[AdMob] GADBannerView not found — SDK not linked");
                        return;
                    };
                    let Some(request_cls) = AnyClass::get(c"GADRequest") else {
                        log::warn!("[AdMob] GADRequest not found — SDK not linked");
                        return;
                    };
                    let Some(ns_str_cls) = AnyClass::get(c"NSString") else { return };

                    unsafe {
                        let wk = wv.inner() as *mut AnyObject;

                        // Get UIWindow
                        let window_obj: *mut AnyObject = msg_send![wk, window];
                        if window_obj.is_null() { return; }

                        // Remove existing banner if any
                        if let Ok(mut guard) = BANNER_PTR.lock() {
                            if let Some(ptr) = guard.take() {
                                let old: *mut AnyObject = ptr as *mut AnyObject;
                                let _: () = msg_send![old, removeFromSuperview];
                            }
                        }

                        // Get screen width for banner frame
                        let screen_cls = AnyClass::get(c"UIScreen").unwrap();
                        let main_screen: *mut AnyObject = msg_send![screen_cls, mainScreen];
                        let bounds: super::super::CGRect = msg_send![main_screen, bounds];
                        let screen_w = bounds.size.width;

                        // Alloc + initWithFrame
                        let frame = super::super::CGRect {
                            origin: super::super::CGPoint { x: 0.0, y: safe_area_top },
                            size: super::super::CGSize { width: screen_w, height: 50.0 },
                        };
                        let banner: *mut AnyObject = msg_send![banner_cls, alloc];
                        let banner: *mut AnyObject = msg_send![banner, initWithFrame: frame];
                        if banner.is_null() { return; }

                        // Set adUnitID
                        let Ok(id_cstr) = CString::new(ad_unit_id.as_str()) else { return };
                        let ns_id: *mut AnyObject = msg_send![
                            ns_str_cls, stringWithUTF8String: id_cstr.as_ptr()
                        ];
                        let _: () = msg_send![banner, setAdUnitID: ns_id];

                        // Set rootViewController
                        let root_vc: *mut AnyObject = msg_send![window_obj, rootViewController];
                        let _: () = msg_send![banner, setRootViewController: root_vc];

                        // Add to window (on top of WKWebView)
                        let _: () = msg_send![window_obj, addSubview: banner];

                        // bringSubviewToFront so it sits above WKWebView
                        let _: () = msg_send![window_obj, bringSubviewToFront: banner];

                        // Load ad
                        let request: *mut AnyObject = msg_send![request_cls, request];
                        let _: () = msg_send![banner, loadRequest: request];

                        // Store pointer for later removal
                        if let Ok(mut guard) = BANNER_PTR.lock() {
                            *guard = Some(banner as usize);
                        }

                        log::info!(
                            "[AdMob] Banner shown (user={}, sat={})",
                            &user_id[..8.min(user_id.len())],
                            safe_area_top
                        );
                    }
                });
            })
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "ios"))]
    {
        let _ = (window, ad_unit_id, user_id, safe_area_top);
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn admob_banner_hide(window: tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(target_os = "ios")]
    {
        window
            .run_on_main_thread(move || {
                use objc2::runtime::AnyObject;
                use objc2::msg_send;

                if let Ok(mut guard) = BANNER_PTR.lock() {
                    if let Some(ptr) = guard.take() {
                        unsafe {
                            let banner: *mut AnyObject = ptr as *mut AnyObject;
                            let _: () = msg_send![banner, removeFromSuperview];
                        }
                        log::info!("[AdMob] Banner hidden");
                    }
                }
            })
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "ios"))]
    {
        let _ = window;
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn admob_banner_is_visible() -> bool {
    #[cfg(target_os = "ios")]
    {
        BANNER_PTR.lock().map(|g| g.is_some()).unwrap_or(false)
    }
    #[cfg(not(target_os = "ios"))]
    false
}
