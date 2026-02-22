use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
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

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AuthMethod {
    #[serde(rename_all = "camelCase")]
    Password { password: String },
    #[serde(rename_all = "camelCase")]
    PrivateKey { key_path: String, passphrase: Option<String> },
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
