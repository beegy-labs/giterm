/// AdMob banner commands — iOS only.
///
/// The native banner is a GADBannerView overlaid at the top of the UIWindow
/// (below safe-area inset). The React layout adjusts via --ad-banner-h CSS var.

#[cfg(target_os = "ios")]
extern "C" {
    fn admob_sdk_init();
    fn admob_show_banner(
        ad_unit_id: *const std::ffi::c_char,
        user_id: *const std::ffi::c_char,
        wk_webview: *mut std::ffi::c_void,
        safe_area_top: f64,
    );
    fn admob_hide_banner();
    fn admob_is_banner_visible() -> std::ffi::c_int;
}

/// Initialize the Google Mobile Ads SDK. Call once on app start.
#[tauri::command]
#[specta::specta]
pub fn admob_init() {
    #[cfg(target_os = "ios")]
    unsafe {
        admob_sdk_init();
    }
}

/// Show the AdMob banner at the top of the screen.
///
/// - `ad_unit_id`: AdMob banner ad unit (e.g. "ca-app-pub-xxx/yyy")
/// - `user_id`:    Per-install UUID for frequency capping
/// - `safe_area_top`: CSS --sat value in pt (injected by Rust safe-area code)
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
        let id_cstr = std::ffi::CString::new(ad_unit_id).map_err(|e| e.to_string())?;
        let uid_cstr = std::ffi::CString::new(user_id).map_err(|e| e.to_string())?;

        window
            .run_on_main_thread(move || {
                let _ = window.with_webview(|wv| {
                    let wk = wv.inner() as *mut std::ffi::c_void;
                    unsafe {
                        admob_show_banner(
                            id_cstr.as_ptr(),
                            uid_cstr.as_ptr(),
                            wk,
                            safe_area_top,
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

/// Hide and destroy the banner.
#[tauri::command]
#[specta::specta]
pub fn admob_banner_hide() {
    #[cfg(target_os = "ios")]
    unsafe {
        admob_hide_banner();
    }
}

/// Returns true if a banner ad is currently visible.
#[tauri::command]
#[specta::specta]
pub fn admob_banner_is_visible() -> bool {
    #[cfg(target_os = "ios")]
    unsafe {
        return admob_is_banner_visible() != 0;
    }
    #[cfg(not(target_os = "ios"))]
    false
}
