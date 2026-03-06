use serde::{Deserialize, Serialize};
use specta::Type;
use std::fmt;
use zeroize::Zeroize;

#[derive(Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: AuthMethod,
    pub startup_command: Option<String>,
    pub jump_host: Option<String>,
    pub jump_port: Option<u16>,
    pub jump_username: Option<String>,
    pub jump_auth_method: Option<AuthMethod>,
}

impl fmt::Debug for ConnectionConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("ConnectionConfig")
            .field("host", &self.host)
            .field("port", &self.port)
            .field("username", &"[REDACTED]")
            .field("auth_method", &self.auth_method)
            .finish()
    }
}

impl fmt::Debug for AuthMethod {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AuthMethod::Password { .. } => f.debug_struct("Password").finish_non_exhaustive(),
            AuthMethod::PrivateKey { key_path, .. } => f
                .debug_struct("PrivateKey")
                .field("key_path", key_path)
                .finish_non_exhaustive(),
        }
    }
}

/// Zeroize sensitive fields when ConnectionConfig goes out of scope.
impl Drop for ConnectionConfig {
    fn drop(&mut self) {
        self.auth_method.zeroize();
        if let Some(ref mut auth) = self.jump_auth_method {
            auth.zeroize();
        }
    }
}

#[derive(Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AuthMethod {
    #[serde(rename_all = "camelCase")]
    Password { password: String },
    #[serde(rename_all = "camelCase")]
    PrivateKey { key_path: String, passphrase: Option<String> },
}

impl Zeroize for AuthMethod {
    fn zeroize(&mut self) {
        match self {
            AuthMethod::Password { password } => {
                password.zeroize();
            }
            AuthMethod::PrivateKey { passphrase, .. } => {
                if let Some(ref mut pp) = passphrase {
                    pp.zeroize();
                }
            }
        }
    }
}

impl Drop for AuthMethod {
    fn drop(&mut self) {
        self.zeroize();
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SshDataPayload {
    pub session_id: String,
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SshDisconnectPayload {
    pub session_id: String,
    pub reason: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_connection_config_serialization() {
        let config = ConnectionConfig {
            host: "example.com".to_string(),
            port: 22,
            username: "user".to_string(),
            auth_method: AuthMethod::Password {
                password: "secret".to_string(),
            },
            startup_command: None,
            jump_host: None,
            jump_port: None,
            jump_username: None,
            jump_auth_method: None,
        };
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: ConnectionConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.host, "example.com");
        assert_eq!(deserialized.port, 22);
    }

    #[test]
    fn test_private_key_auth_serialization() {
        let config = ConnectionConfig {
            host: "server.local".to_string(),
            port: 2222,
            username: "admin".to_string(),
            auth_method: AuthMethod::PrivateKey {
                key_path: "/home/user/.ssh/id_ed25519".to_string(),
                passphrase: None,
            },
            startup_command: None,
            jump_host: None,
            jump_port: None,
            jump_username: None,
            jump_auth_method: None,
        };
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("privateKey"));
        let deserialized: ConnectionConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.username, "admin");
    }
}
