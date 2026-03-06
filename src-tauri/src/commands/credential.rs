use zeroize::Zeroize;

const SERVICE_NAME: &str = "com.vero.giterm";
/// Keep in sync with SECRET_FIELDS in src/entities/connection/model/connectionStore.ts
const ALLOWED_FIELDS: &[&str] = &["password", "passphrase", "jumpPassword", "jumpPassphrase"];

fn validate_field(field: &str) -> Result<(), String> {
    if ALLOWED_FIELDS.contains(&field) {
        Ok(())
    } else {
        Err(format!("Invalid credential field: {}", field))
    }
}

/// Store a secret (password or passphrase) in the OS keychain.
/// The key is formatted as "{connection_id}.{field}" (e.g. "uuid.password").
#[tauri::command]
#[specta::specta]
pub fn credential_store(connection_id: String, field: String, mut secret: String) -> Result<(), String> {
    validate_field(&field)?;
    let account = format!("{}.{}", connection_id, field);
    let entry = keyring::Entry::new(SERVICE_NAME, &account)
        .map_err(|e| format!("Keychain error: {}", e))?;
    let result = entry.set_password(&secret)
        .map_err(|e| format!("Failed to store credential: {}", e));
    secret.zeroize();
    result
}

/// Retrieve a secret from the OS keychain.
#[tauri::command]
#[specta::specta]
pub fn credential_get(connection_id: String, field: String) -> Result<Option<String>, String> {
    validate_field(&field)?;
    let account = format!("{}.{}", connection_id, field);
    let entry = keyring::Entry::new(SERVICE_NAME, &account)
        .map_err(|e| format!("Keychain error: {}", e))?;
    match entry.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to get credential: {}", e)),
    }
}

/// Delete a secret from the OS keychain.
#[tauri::command]
#[specta::specta]
pub fn credential_delete(connection_id: String, field: String) -> Result<(), String> {
    validate_field(&field)?;
    let account = format!("{}.{}", connection_id, field);
    let entry = keyring::Entry::new(SERVICE_NAME, &account)
        .map_err(|e| format!("Keychain error: {}", e))?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Failed to delete credential: {}", e)),
    }
}

/// Delete all secrets for a connection.
#[tauri::command]
#[specta::specta]
pub fn credential_delete_all(connection_id: String) -> Result<(), String> {
    for field in ALLOWED_FIELDS {
        let account = format!("{}.{}", connection_id, field);
        let Ok(entry) = keyring::Entry::new(SERVICE_NAME, &account) else { continue };
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(e) => log::warn!("Failed to delete credential {}: {}", field, e),
        }
    }
    Ok(())
}
