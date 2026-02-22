use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, Mutex};
use russh::{client, ChannelMsg, Channel, Disconnect};
use russh::keys::{load_secret_key, PrivateKeyWithHashAlg};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use super::client::SshClient;
use super::types::{AuthMethod, ConnectionConfig, SshDataPayload, SshDisconnectPayload};

const SSH_CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

enum ChannelCommand {
    Data(Vec<u8>),
    Resize { cols: u32, rows: u32 },
    Close,
}

struct SshSession {
    handle: Arc<Mutex<client::Handle<SshClient>>>,
    cmd_tx: mpsc::Sender<ChannelCommand>,
    jump_handle: Option<client::Handle<SshClient>>,
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
        let sessions = self.sessions.clone();
        tokio::time::timeout(SSH_CONNECT_TIMEOUT, Self::connect_inner(sessions, config, app_handle))
            .await
            .map_err(|_| "Connection timeout".to_string())?
    }

    async fn authenticate(
        handle: &mut client::Handle<SshClient>,
        username: &str,
        auth_method: &AuthMethod,
    ) -> Result<(), String> {
        match auth_method {
            AuthMethod::Password { password } => {
                let auth_result = handle
                    .authenticate_password(username, password)
                    .await
                    .map_err(|e| format!("Authentication failed: {}", e))?;
                if !auth_result.success() {
                    return Err("Authentication failed".to_string());
                }
            }
            AuthMethod::PrivateKey { key_path, passphrase } => {
                let key = load_secret_key(key_path, passphrase.as_deref())
                    .map_err(|e| format!("Failed to load key: {}", e))?;
                let best_hash = handle
                    .best_supported_rsa_hash()
                    .await
                    .map_err(|e| format!("Hash negotiation failed: {}", e))?
                    .flatten();
                let key_with_hash = PrivateKeyWithHashAlg::new(Arc::new(key), best_hash);
                let auth_result = handle
                    .authenticate_publickey(username, key_with_hash)
                    .await
                    .map_err(|e| format!("Authentication failed: {}", e))?;
                if !auth_result.success() {
                    return Err("Authentication failed".to_string());
                }
            }
        }
        Ok(())
    }

    async fn connect_inner(
        sessions: Arc<Mutex<HashMap<String, SshSession>>>,
        config: ConnectionConfig,
        app_handle: AppHandle,
    ) -> Result<String, String> {
        let session_id = Uuid::new_v4().to_string();

        let ssh_config = Arc::new(client::Config {
            inactivity_timeout: Some(Duration::from_secs(600)),
            keepalive_interval: Some(Duration::from_secs(15)),
            keepalive_max: 3,
            ..Default::default()
        });

        let mut jump_handle_opt: Option<client::Handle<SshClient>> = None;

        // If jump host is configured, connect through it
        let mut handle = if let Some(ref jump_host) = config.jump_host {
            let jump_port = config.jump_port.unwrap_or(22);
            let jump_username = config.jump_username.clone().unwrap_or_else(|| config.username.clone());
            let jump_auth = config.jump_auth_method.clone().unwrap_or_else(|| config.auth_method.clone());

            // Connect to jump host
            let jump_client = SshClient::new(app_handle.clone(), format!("{}-jump", session_id));
            let jump_addr = format!("{}:{}", jump_host, jump_port);
            let mut jh = client::connect(ssh_config.clone(), jump_addr.as_str(), jump_client)
                .await
                .map_err(|e| format!("Jump host connect: {}", e))?;

            // Authenticate to jump host
            Self::authenticate(&mut jh, &jump_username, &jump_auth).await
                .map_err(|e| format!("Jump host: {}", e))?;

            // Open direct-tcpip channel to target host through jump host
            let forwarded_channel = jh
                .channel_open_direct_tcpip(&config.host, config.port as u32, "127.0.0.1", 0)
                .await
                .map_err(|e| format!("Jump host forwarding failed: {}", e))?;

            // Create a TCP stream pair for the forwarded channel
            let (client_stream, server_stream) = tokio::io::duplex(65536);

            // Spawn a task to bridge forwarded_channel <-> server_stream
            let mut fw_channel = forwarded_channel;
            tokio::spawn(async move {
                use tokio::io::{AsyncReadExt, AsyncWriteExt};
                let (mut read_half, mut write_half) = tokio::io::split(server_stream);

                loop {
                    tokio::select! {
                        msg = fw_channel.wait() => {
                            match msg {
                                Some(ChannelMsg::Data { ref data }) => {
                                    if write_half.write_all(data).await.is_err() {
                                        break;
                                    }
                                }
                                Some(ChannelMsg::Eof) | Some(ChannelMsg::Close) | None => {
                                    break;
                                }
                                _ => {}
                            }
                        }
                        result = async {
                            let mut buf = [0u8; 8192];
                            read_half.read(&mut buf).await.map(|n| (n, buf))
                        } => {
                            match result {
                                Ok((0, _)) => break,
                                Ok((n, buf)) => {
                                    if fw_channel.data(&buf[..n]).await.is_err() {
                                        break;
                                    }
                                }
                                Err(_) => break,
                            }
                        }
                    }
                }
            });

            // Connect SSH through the duplex stream to the target
            let target_client = SshClient::new(app_handle.clone(), session_id.clone());
            let target_handle = client::connect_stream(ssh_config, client_stream, target_client)
                .await
                .map_err(|e| format!("Target connect via jump: {}", e))?;

            jump_handle_opt = Some(jh);
            target_handle
        } else {
            // Direct connection
            let direct_client = SshClient::new(app_handle.clone(), session_id.clone());
            let addr = format!("{}:{}", config.host, config.port);
            client::connect(ssh_config, addr.as_str(), direct_client)
                .await
                .map_err(|e| format!("connect: {}", e))?
        };

        // Authenticate to target
        Self::authenticate(&mut handle, &config.username, &config.auth_method).await?;

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

        // Create mpsc channel for sending commands to the channel task
        let (cmd_tx, cmd_rx) = mpsc::channel::<ChannelCommand>(64);

        // Send startup command after shell is ready
        if let Some(ref startup_cmd) = config.startup_command {
            if !startup_cmd.is_empty() {
                let cmd = format!("{}\n", startup_cmd);
                let cmd_tx_clone = cmd_tx.clone();
                let startup_data = cmd.into_bytes();
                tokio::spawn(async move {
                    tokio::time::sleep(Duration::from_millis(500)).await;
                    let _ = cmd_tx_clone.send(ChannelCommand::Data(startup_data)).await;
                });
            }
        }

        // Store session (handle + command sender only, no Channel)
        let session = SshSession {
            handle: Arc::new(Mutex::new(handle)),
            cmd_tx,
            jump_handle: jump_handle_opt,
        };

        sessions.lock().await.insert(session_id.clone(), session);

        // Spawn the channel task — owns the Channel exclusively, no mutex needed
        let sid = session_id.clone();
        let app = app_handle.clone();
        let sessions_clone = sessions.clone();

        tokio::spawn(async move {
            Self::channel_task(channel, cmd_rx, sessions_clone, sid, app).await;
        });

        Ok(session_id)
    }

    async fn channel_task(
        mut channel: Channel<client::Msg>,
        mut cmd_rx: mpsc::Receiver<ChannelCommand>,
        sessions: Arc<Mutex<HashMap<String, SshSession>>>,
        session_id: String,
        app_handle: AppHandle,
    ) {
        loop {
            tokio::select! {
                msg = channel.wait() => {
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
                cmd = cmd_rx.recv() => {
                    match cmd {
                        Some(ChannelCommand::Data(data)) => {
                            if channel.data(&data[..]).await.is_err() {
                                break;
                            }
                        }
                        Some(ChannelCommand::Resize { cols, rows }) => {
                            let _ = channel.window_change(cols, rows, 0, 0).await;
                        }
                        Some(ChannelCommand::Close) | None => {
                            let _ = channel.eof().await;
                            break;
                        }
                    }
                }
            }
        }

        // Cleanup
        sessions.lock().await.remove(&session_id);
    }

    pub async fn test_connection(
        &self,
        config: ConnectionConfig,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        tokio::time::timeout(
            SSH_CONNECT_TIMEOUT,
            Self::test_connection_inner(config, app_handle),
        )
        .await
        .map_err(|_| "Connection timeout".to_string())?
    }

    async fn test_connection_inner(
        config: ConnectionConfig,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let ssh_config = Arc::new(client::Config {
            inactivity_timeout: Some(Duration::from_secs(10)),
            ..Default::default()
        });

        let client = SshClient::new(app_handle, "test".to_string());
        let addr = format!("{}:{}", config.host, config.port);

        let mut handle = client::connect(ssh_config, addr.as_str(), client)
            .await
            .map_err(|e| format!("connect: {}", e))?;

        Self::authenticate(&mut handle, &config.username, &config.auth_method).await?;

        // Disconnect immediately — test successful
        let _ = handle
            .disconnect(Disconnect::ByApplication, "", "English")
            .await;

        Ok(())
    }

    pub async fn write(&self, session_id: &str, data: &[u8]) -> Result<(), String> {
        let sessions = self.sessions.lock().await;
        let session = sessions
            .get(session_id)
            .ok_or_else(|| "Session not found".to_string())?;
        session
            .cmd_tx
            .send(ChannelCommand::Data(data.to_vec()))
            .await
            .map_err(|_| "Session closed".to_string())?;
        Ok(())
    }

    pub async fn resize(
        &self,
        session_id: &str,
        cols: u32,
        rows: u32,
    ) -> Result<(), String> {
        let sessions = self.sessions.lock().await;
        let session = sessions
            .get(session_id)
            .ok_or_else(|| "Session not found".to_string())?;
        session
            .cmd_tx
            .send(ChannelCommand::Resize { cols, rows })
            .await
            .map_err(|_| "Session closed".to_string())?;
        Ok(())
    }

    pub async fn get_handle(
        &self,
        session_id: &str,
    ) -> Result<Arc<Mutex<client::Handle<SshClient>>>, String> {
        let sessions = self.sessions.lock().await;
        let session = sessions
            .get(session_id)
            .ok_or_else(|| "Session not found".to_string())?;
        Ok(session.handle.clone())
    }

    pub async fn exec(
        &self,
        session_id: &str,
        command: &str,
    ) -> Result<String, String> {
        let sessions = self.sessions.lock().await;
        let session = sessions
            .get(session_id)
            .ok_or_else(|| "Session not found".to_string())?;

        let handle = session.handle.lock().await;
        let channel = handle
            .channel_open_session()
            .await
            .map_err(|e| format!("Channel open failed: {}", e))?;
        drop(handle);

        channel
            .exec(true, command)
            .await
            .map_err(|e| format!("Exec failed: {}", e))?;

        let mut output = Vec::new();
        let mut ch = channel;
        loop {
            match ch.wait().await {
                Some(ChannelMsg::Data { ref data }) => {
                    output.extend_from_slice(data);
                }
                Some(ChannelMsg::ExtendedData { ref data, .. }) => {
                    output.extend_from_slice(data);
                }
                Some(ChannelMsg::Eof) | Some(ChannelMsg::Close) | None => {
                    break;
                }
                _ => {}
            }
        }

        String::from_utf8(output).map_err(|e| format!("UTF-8 error: {}", e))
    }

    pub async fn disconnect(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        if let Some(session) = sessions.remove(session_id) {
            let _ = session.cmd_tx.send(ChannelCommand::Close).await;
            let handle = session.handle.lock().await;
            let _ = handle
                .disconnect(Disconnect::ByApplication, "", "English")
                .await;
            drop(handle);
            // Also disconnect jump host if present
            if let Some(jh) = session.jump_handle {
                let _ = jh
                    .disconnect(Disconnect::ByApplication, "", "English")
                    .await;
            }
        }
        Ok(())
    }
}
