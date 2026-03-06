use russh::keys::ssh_key::PublicKey;
use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::sync::Mutex;

/// Result of checking a host key against the known_hosts store.
#[derive(Debug, Clone, PartialEq)]
pub enum HostKeyStatus {
    /// Key matches a previously stored key.
    Known,
    /// Host has never been seen before; key should be offered to the user.
    Unknown { fingerprint: String },
    /// Host is known but the key has CHANGED — possible MITM.
    Changed { old_fingerprint: String, new_fingerprint: String },
}

/// Thread-safe known_hosts store backed by a file.
pub struct KnownHostsStore {
    /// host:port -> base64-encoded public key
    entries: Mutex<HashMap<String, String>>,
    path: PathBuf,
}

impl KnownHostsStore {
    /// Load or create the known_hosts file at `~/.giterm/known_hosts`.
    pub fn load() -> Self {
        let path = dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".giterm")
            .join("known_hosts");

        let entries = if path.exists() {
            Self::parse_file(&path)
        } else {
            HashMap::new()
        };

        Self {
            entries: Mutex::new(entries),
            path,
        }
    }

    fn parse_file(path: &PathBuf) -> HashMap<String, String> {
        let mut map = HashMap::new();
        if let Ok(file) = fs::File::open(path) {
            let reader = BufReader::new(file);
            for line in reader.lines() {
                let Ok(line) = line else { continue };
                let line = line.trim().to_string();
                if line.is_empty() || line.starts_with('#') {
                    continue;
                }
                // Format: host:port <base64-key>
                if let Some((host_port, key_b64)) = line.split_once(' ') {
                    map.insert(host_port.to_string(), key_b64.to_string());
                }
            }
        }
        map
    }

    /// Fingerprint string for display (SHA-256).
    fn fingerprint(key: &PublicKey) -> Result<String, String> {
        use sha2::{Sha256, Digest};
        use base64::Engine;
        let key_bytes = key.to_bytes().map_err(|e| format!("Failed to serialize public key: {}", e))?;
        let hash = Sha256::digest(&key_bytes);
        let b64 = base64::engine::general_purpose::STANDARD.encode(hash);
        Ok(format!("SHA256:{}", b64))
    }

    /// Compute SHA256 fingerprint from a stored base64-encoded public key.
    /// If decoding fails, returns a placeholder string.
    fn fingerprint_from_stored(stored_b64: &str) -> String {
        use base64::Engine;
        use sha2::{Sha256, Digest};

        let key_bytes = match base64::engine::general_purpose::STANDARD.decode(stored_b64) {
            Ok(bytes) => bytes,
            Err(_) => return "(unable to compute)".to_string(),
        };
        match PublicKey::from_bytes(&key_bytes) {
            Ok(pubkey) => {
                Self::fingerprint(&pubkey).unwrap_or_else(|_| "(unable to compute)".to_string())
            }
            Err(_) => {
                // Fall back: hash the raw stored bytes directly
                let hash = Sha256::digest(&key_bytes);
                let b64 = base64::engine::general_purpose::STANDARD.encode(hash);
                format!("SHA256:{}", b64)
            }
        }
    }

    fn encode_key(key: &PublicKey) -> Result<String, String> {
        use base64::Engine;
        let key_bytes = key.to_bytes().map_err(|e| format!("Failed to serialize public key: {}", e))?;
        Ok(base64::engine::general_purpose::STANDARD.encode(key_bytes))
    }

    /// Check the given host key.
    pub fn check(&self, host: &str, port: u16, key: &PublicKey) -> Result<HostKeyStatus, String> {
        let host_port = format!("{}:{}", host, port);
        let encoded = Self::encode_key(key)?;
        let entries = self.entries.lock().unwrap_or_else(|e| e.into_inner());

        match entries.get(&host_port) {
            Some(stored) if *stored == encoded => Ok(HostKeyStatus::Known),
            Some(stored) => {
                let old_fingerprint = Self::fingerprint_from_stored(stored);
                Ok(HostKeyStatus::Changed {
                    old_fingerprint,
                    new_fingerprint: Self::fingerprint(key)?,
                })
            }
            None => Ok(HostKeyStatus::Unknown {
                fingerprint: Self::fingerprint(key)?,
            }),
        }
    }

    /// Trust and persist a host key.
    pub fn accept(&self, host: &str, port: u16, key: &PublicKey) -> Result<(), String> {
        let host_port = format!("{}:{}", host, port);
        let encoded = Self::encode_key(key)?;

        {
            let mut entries = self.entries.lock().unwrap_or_else(|e| e.into_inner());
            entries.insert(host_port.clone(), encoded.clone());
        }

        self.save_to_file()
    }

    fn save_to_file(&self) -> Result<(), String> {
        // Ensure directory exists
        if let Some(parent) = self.path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create dir: {}", e))?;
        }

        // Atomic write: write to temp file, then rename (prevents data loss on crash)
        let tmp_path = self.path.with_extension("tmp");
        let entries = self.entries.lock().unwrap_or_else(|e| e.into_inner());
        {
            let mut file = fs::File::create(&tmp_path)
                .map_err(|e| format!("Failed to write known_hosts: {}", e))?;

            writeln!(file, "# giterm known_hosts — do not edit manually")
                .map_err(|e| e.to_string())?;

            for (hp, key) in entries.iter() {
                writeln!(file, "{} {}", hp, key).map_err(|e| e.to_string())?;
            }
        }

        fs::rename(&tmp_path, &self.path)
            .map_err(|e| format!("Failed to rename known_hosts: {}", e))?;

        Ok(())
    }
}
