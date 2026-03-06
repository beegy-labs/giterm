use std::sync::Mutex;

/// Generic debug log state parameterized by a filename prefix.
/// Used by both IME log and viewport log modules.
pub struct DebugLogState {
    prefix: &'static str,
    #[cfg(debug_assertions)]
    pub path: Mutex<Option<std::path::PathBuf>>,
    // Keep prefix accessible even in release builds so the struct is valid.
    #[cfg(not(debug_assertions))]
    _prefix: &'static str,
}

impl DebugLogState {
    pub fn new(prefix: &'static str) -> Self {
        Self {
            prefix,
            #[cfg(debug_assertions)]
            path: Mutex::new(None),
            #[cfg(not(debug_assertions))]
            _prefix: prefix,
        }
    }

    /// Start a new log session. Creates a timestamped file in temp dir.
    /// Returns the file path. **Only available in debug builds.**
    #[cfg(debug_assertions)]
    pub fn start(&self) -> Result<String, String> {
        let now = chrono::Local::now();
        let filename = format!("{}{}.log", self.prefix, now.format("%Y%m%d-%H%M%S"));
        let path = std::env::temp_dir().join(&filename);

        let header = format!(
            "=== giterm {} log \u{2014} {} ===\n",
            self.prefix.trim_end_matches('-'),
            now.format("%Y-%m-%d %H:%M:%S")
        );
        std::fs::write(&path, header).map_err(|e| e.to_string())?;

        let path_str = path.to_string_lossy().to_string();
        *self.path.lock().unwrap_or_else(|e| e.into_inner()) = Some(path);
        Ok(path_str)
    }

    /// Append a line to the current log (with timestamp prefix).
    /// **Only available in debug builds.**
    #[cfg(debug_assertions)]
    pub fn append(&self, line: &str) -> Result<(), String> {
        use std::fs::OpenOptions;
        use std::io::Write;
        let guard = self.path.lock().unwrap_or_else(|e| e.into_inner());
        let path = guard.as_ref().ok_or("Log not started")?;

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

    /// Stop the current log session.
    /// **Only available in debug builds.**
    #[cfg(debug_assertions)]
    pub fn stop(&self) -> Result<(), String> {
        use std::fs::OpenOptions;
        use std::io::Write;
        let mut guard = self.path.lock().unwrap_or_else(|e| e.into_inner());
        // Take the path first so guard is None regardless of write errors
        if let Some(path) = guard.take() {
            let write_result = OpenOptions::new()
                .append(true)
                .open(&path)
                .and_then(|mut file| writeln!(file, "=== session ended ==="));
            if let Err(e) = write_result {
                log::warn!("Failed to write session end marker: {}", e);
            }
        }
        Ok(())
    }
}
