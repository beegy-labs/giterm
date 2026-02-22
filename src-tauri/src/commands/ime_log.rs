use std::fs::OpenOptions;
use std::io::Write;
use std::sync::Mutex;
use tauri::State;

pub struct ImeLogState {
    pub path: Mutex<Option<std::path::PathBuf>>,
}

impl ImeLogState {
    pub fn new() -> Self {
        Self {
            path: Mutex::new(None),
        }
    }
}

/// Start a new IME log session. Creates a timestamped file in temp dir.
/// Returns the file path.
#[tauri::command]
#[specta::specta]
pub fn ime_log_start(state: State<ImeLogState>) -> Result<String, String> {
    let now = chrono::Local::now();
    let filename = format!("giterm-ime-{}.log", now.format("%Y%m%d-%H%M%S"));
    let path = std::env::temp_dir().join(&filename);

    // Write header
    let header = format!(
        "=== giterm IME log — {} ===\n",
        now.format("%Y-%m-%d %H:%M:%S")
    );
    std::fs::write(&path, header).map_err(|e| e.to_string())?;

    let path_str = path.to_string_lossy().to_string();
    *state.path.lock().unwrap() = Some(path);
    Ok(path_str)
}

/// Append a line to the current IME log (with timestamp prefix).
#[tauri::command]
#[specta::specta]
pub fn ime_log_append(line: String, state: State<ImeLogState>) -> Result<(), String> {
    let guard = state.path.lock().unwrap();
    let path = guard.as_ref().ok_or("IME log not started")?;

    let now = chrono::Local::now();
    let timestamped = format!("[{}] {}\n", now.format("%H:%M:%S%.3f"), line);

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|e| e.to_string())?;
    file.write_all(timestamped.as_bytes())
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Stop the current IME log session.
#[tauri::command]
#[specta::specta]
pub fn ime_log_stop(state: State<ImeLogState>) -> Result<(), String> {
    let mut guard = state.path.lock().unwrap();
    if let Some(path) = guard.as_ref() {
        let mut file = OpenOptions::new()
            .append(true)
            .open(path)
            .map_err(|e| e.to_string())?;
        writeln!(file, "=== session ended ===").map_err(|e| e.to_string())?;
    }
    *guard = None;
    Ok(())
}
