use super::debug_log::DebugLogState;

pub struct VpLogState(DebugLogState);

impl VpLogState {
    pub fn new() -> Self {
        Self(DebugLogState::new("giterm-vp-"))
    }
}

/// Start a new viewport log session.
/// **Only available in debug builds.**
#[tauri::command]
#[specta::specta]
pub fn vp_log_start(
    #[allow(unused_variables)] state: tauri::State<VpLogState>,
) -> Result<String, String> {
    #[cfg(debug_assertions)]
    {
        state.0.start()
    }
    #[cfg(not(debug_assertions))]
    {
        Err("Viewport logging is disabled in release builds".to_string())
    }
}

/// Append a line to the viewport log.
/// **Only available in debug builds.**
#[tauri::command]
#[specta::specta]
pub fn vp_log_append(
    #[allow(unused_variables)] line: String,
    #[allow(unused_variables)] state: tauri::State<VpLogState>,
) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        state.0.append(&line)
    }
    #[cfg(not(debug_assertions))]
    {
        Ok(())
    }
}

/// Stop the viewport log session.
/// **Only available in debug builds.**
#[tauri::command]
#[specta::specta]
pub fn vp_log_stop(
    #[allow(unused_variables)] state: tauri::State<VpLogState>,
) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        state.0.stop()
    }
    #[cfg(not(debug_assertions))]
    {
        Ok(())
    }
}
