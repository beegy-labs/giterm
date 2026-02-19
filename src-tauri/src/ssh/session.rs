use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use russh::{client, ChannelMsg, Channel, Disconnect};
use russh::keys::{load_secret_key, PrivateKeyWithHashAlg};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use super::client::SshClient;
use super::types::{AuthMethod, ConnectionConfig, SshDataPayload, SshDisconnectPayload};

struct SshSession {
    handle: client::Handle<SshClient>,
    channel: Channel<client::Msg>,
}

pub struct SshSessionManager {
    sessions: Arc<Mutex<HashMap<String, SshSession>>>,
}

impl SshSessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn connect(
        &self,
        config: ConnectionConfig,
        app_handle: AppHandle,
    ) -> Result<String, String> {
        let session_id = Uuid::new_v4().to_string();

        let ssh_config = Arc::new(client::Config {
            inactivity_timeout: Some(std::time::Duration::from_secs(600)),
            keepalive_interval: Some(std::time::Duration::from_secs(15)),
            keepalive_max: 3,
            ..Default::default()
        });

        let client = SshClient::new(app_handle.clone(), session_id.clone());
        let addr = format!("{}:{}", config.host, config.port);

        let mut handle = client::connect(ssh_config, addr.as_str(), client)
            .await
            .map_err(|e| format!("Connection failed: {}", e))?;

        // Authenticate
        match config.auth_method {
            AuthMethod::Password { password } => {
                let auth_result = handle
                    .authenticate_password(&config.username, &password)
                    .await
                    .map_err(|e| format!("Auth failed: {}", e))?;
                if !auth_result.success() {
                    return Err("Password authentication failed".to_string());
                }
            }
            AuthMethod::PrivateKey { key_path, passphrase } => {
                let key = load_secret_key(&key_path, passphrase.as_deref())
                    .map_err(|e| format!("Failed to load key: {}", e))?;
                let best_hash = handle
                    .best_supported_rsa_hash()
                    .await
                    .map_err(|e| format!("Hash negotiation failed: {}", e))?
                    .flatten();
                let key_with_hash = PrivateKeyWithHashAlg::new(Arc::new(key), best_hash);
                let auth_result = handle
                    .authenticate_publickey(&config.username, key_with_hash)
                    .await
                    .map_err(|e| format!("Auth failed: {}", e))?;
                if !auth_result.success() {
                    return Err("Public key authentication failed".to_string());
                }
            }
        }

        // Open channel and request shell
        let channel = handle
            .channel_open_session()
            .await
            .map_err(|e| format!("Channel open failed: {}", e))?;

        channel
            .request_pty(false, "xterm-256color", 80, 24, 0, 0, &[])
            .await
            .map_err(|e| format!("PTY request failed: {}", e))?;

        channel
            .request_shell(false)
            .await
            .map_err(|e| format!("Shell request failed: {}", e))?;

        // Store session
        let session = SshSession {
            handle,
            channel,
        };

        // Spawn a task to read data from the channel
        let sessions = self.sessions.clone();
        let sid = session_id.clone();
        let app = app_handle.clone();

        self.sessions.lock().await.insert(session_id.clone(), session);

        // Start the data reading loop in a background task
        tokio::spawn(async move {
            Self::read_loop(sessions, sid, app).await;
        });

        Ok(session_id)
    }

    async fn read_loop(
        sessions: Arc<Mutex<HashMap<String, SshSession>>>,
        session_id: String,
        app_handle: AppHandle,
    ) {
        loop {
            // Take the channel out briefly to call wait()
            let msg = {
                let mut sessions_guard = sessions.lock().await;
                let session = match sessions_guard.get_mut(&session_id) {
                    Some(s) => s,
                    None => break,
                };
                session.channel.wait().await
            };

            match msg {
                Some(ChannelMsg::Data { ref data }) => {
                    let payload = SshDataPayload {
                        session_id: session_id.clone(),
                        data: data.to_vec(),
                    };
                    let _ = app_handle.emit("ssh-data", &payload);
                }
                Some(ChannelMsg::ExtendedData { ref data, ext: 1 }) => {
                    let payload = SshDataPayload {
                        session_id: session_id.clone(),
                        data: data.to_vec(),
                    };
                    let _ = app_handle.emit("ssh-data", &payload);
                }
                Some(ChannelMsg::Eof) | Some(ChannelMsg::Close) | None => {
                    let _ = app_handle.emit(
                        "ssh-disconnect",
                        &SshDisconnectPayload {
                            session_id: session_id.clone(),
                            reason: "Connection closed".to_string(),
                        },
                    );
                    sessions.lock().await.remove(&session_id);
                    break;
                }
                _ => {}
            }
        }
    }

    pub async fn write(&self, session_id: &str, data: &[u8]) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| "Session not found".to_string())?;
        session
            .channel
            .data(data)
            .await
            .map_err(|e| format!("Write failed: {}", e))?;
        Ok(())
    }

    pub async fn resize(
        &self,
        session_id: &str,
        cols: u32,
        rows: u32,
    ) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| "Session not found".to_string())?;
        session
            .channel
            .window_change(cols, rows, 0, 0)
            .await
            .map_err(|e| format!("Resize failed: {}", e))?;
        Ok(())
    }

    pub async fn disconnect(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        if let Some(session) = sessions.remove(session_id) {
            let _ = session.channel.eof().await;
            let _ = session
                .handle
                .disconnect(Disconnect::ByApplication, "", "English")
                .await;
        }
        Ok(())
    }
}
