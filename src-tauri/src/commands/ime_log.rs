use super::debug_log::DebugLogState;

pub struct ImeLogState(DebugLogState);

impl ImeLogState {
    pub fn new() -> Self {
        Self(DebugLogState::new("giterm-ime-"))
    }
}

/// Start a new IME log session. Creates a timestamped file in temp dir.
/// Returns the file path. **Only available in debug builds.**
#[tauri::command]
#[specta::specta]
pub fn ime_log_start(
    #[allow(unused_variables)] state: tauri::State<ImeLogState>,
) -> Result<String, String> {
    #[cfg(debug_assertions)]
    {
        state.0.start()
    }
    #[cfg(not(debug_assertions))]
    {
        Err("IME logging is disabled in release builds".to_string())
    }
}

/// Append a line to the current IME log (with timestamp prefix).
/// **Only available in debug builds.**
#[tauri::command]
#[specta::specta]
pub fn ime_log_append(
    #[allow(unused_variables)] line: String,
    #[allow(unused_variables)] state: tauri::State<ImeLogState>,
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

/// Stop the current IME log session.
/// **Only available in debug builds.**
#[tauri::command]
#[specta::specta]
pub fn ime_log_stop(
    #[allow(unused_variables)] state: tauri::State<ImeLogState>,
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
