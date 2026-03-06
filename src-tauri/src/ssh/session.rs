use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, oneshot, Mutex};
use russh::{client, ChannelMsg, Channel, Disconnect};
use russh::keys::{load_secret_key, PrivateKeyWithHashAlg};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;
use super::client::SshClient;
use super::known_hosts::KnownHostsStore;
use super::types::{AuthMethod, ConnectionConfig, SshDataPayload, SshDisconnectPayload};

const SSH_CONNECT_TIMEOUT: Duration = Duration::from_secs(60);
const SSH_EXEC_TIMEOUT: Duration = Duration::from_secs(30);
const SSH_INACTIVITY_TIMEOUT: Duration = Duration::from_secs(600);
const SSH_KEEPALIVE_INTERVAL: Duration = Duration::from_secs(15);
const SSH_KEEPALIVE_MAX: usize = 3;
const SSH_DEFAULT_PORT: u16 = 22;
const DUPLEX_BUFFER_SIZE: usize = 65536;
const CHANNEL_BUFFER_SIZE: usize = 64;
const FORWARD_BUFFER_SIZE: usize = 8192;
const STARTUP_DELAY: Duration = Duration::from_millis(500);
const MAX_EXEC_OUTPUT: usize = 10 * 1024 * 1024;

async fn store_verify_tx(
    pending: &Mutex<HashMap<String, oneshot::Sender<bool>>>,
    client: &SshClient,
    key: String,
) {
    if let Some(tx) = client.take_verify_tx() {
        pending.lock().await.insert(key, tx);
    }
}

enum ChannelCommand {
    Data(Vec<u8>),
    Resize { cols: u32, rows: u32 },
    Close,
}

struct SshSession {
    handle: Arc<Mutex<client::Handle<SshClient>>>,
    cmd_tx: mpsc::Sender<ChannelCommand>,
    jump_handle: Option<client::Handle<SshClient>>,
    jump_forward_task: Option<tokio::task::JoinHandle<()>>,
}

pub struct SshSessionManager {
    sessions: Arc<Mutex<HashMap<String, SshSession>>>,
    known_hosts: Arc<KnownHostsStore>,
    /// Pending host key verification senders, keyed by session_id.
    pending_verify: Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>,
}

impl SshSessionManager {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
            known_hosts: Arc::new(KnownHostsStore::load()),
            pending_verify: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Resolve a pending host key verification (called from the Tauri command).
    pub async fn resolve_host_key_verify(&self, session_id: &str, accepted: bool) {
        let mut pending = self.pending_verify.lock().await;
        if let Some(tx) = pending.remove(session_id) {
            if tx.send(accepted).is_err() {
                log::debug!("Host key verify response dropped (receiver closed)");
            }
        }
    }

    pub async fn connect(
        &self,
        config: ConnectionConfig,
        app_handle: AppHandle,
    ) -> Result<String, String> {
        let sessions = self.sessions.clone();
        let known_hosts = self.known_hosts.clone();
        let pending_verify = self.pending_verify.clone();
        let pending_verify_cleanup = self.pending_verify.clone();
        let session_id_prefix = Uuid::new_v4().to_string();
        let cleanup_id = session_id_prefix.clone();
        let result = tokio::time::timeout(
            SSH_CONNECT_TIMEOUT,
            Self::connect_inner(sessions, config, app_handle, known_hosts, pending_verify, session_id_prefix),
        )
        .await
        .map_err(|_| {
            let pending = pending_verify_cleanup.clone();
            let cid = cleanup_id.clone();
            tokio::spawn(async move {
                let mut p = pending.lock().await;
                p.remove(&cid);
                p.remove(&format!("{}-jump", cid));
            });
            "Connection timeout".to_string()
        })?;
        result
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
                // Validate key_path is under $HOME/.ssh/
                let canonical = std::path::Path::new(key_path)
                    .canonicalize()
                    .map_err(|e| format!("Invalid key path: {}", e))?;
                let ssh_dir = dirs::home_dir()
                    .ok_or_else(|| "Cannot determine home directory".to_string())?
                    .join(".ssh");
                if !canonical.starts_with(&ssh_dir) {
                    return Err(format!(
                        "Key path must be under ~/.ssh/ (got {})",
                        canonical.display()
                    ));
                }
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
        known_hosts: Arc<KnownHostsStore>,
        pending_verify: Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>,
        session_id: String,
    ) -> Result<String, String> {

        let ssh_config = Arc::new(client::Config {
            inactivity_timeout: Some(SSH_INACTIVITY_TIMEOUT),
            keepalive_interval: Some(SSH_KEEPALIVE_INTERVAL),
            keepalive_max: SSH_KEEPALIVE_MAX,
            ..Default::default()
        });

        let mut jump_handle_opt: Option<(client::Handle<SshClient>, tokio::task::JoinHandle<()>)> = None;

        // If jump host is configured, connect through it
        let mut handle = if let Some(ref jump_host) = config.jump_host {
            let jump_port = config.jump_port.unwrap_or(SSH_DEFAULT_PORT);
            let jump_username = config.jump_username.as_ref().unwrap_or(&config.username).clone();
            let jump_auth = config.jump_auth_method.as_ref().unwrap_or(&config.auth_method).clone();

            // Connect to jump host
            let jump_client = SshClient::new(
                app_handle.clone(),
                format!("{}-jump", session_id),
                jump_host.clone(),
                jump_port,
                known_hosts.clone(),
            );

            // Store the verify_tx before connecting (connect consumes the handler)
            let jump_session_id = format!("{}-jump", session_id);
            store_verify_tx(&pending_verify, &jump_client, jump_session_id.clone()).await;

            let jump_addr = format!("{}:{}", jump_host, jump_port);
            let mut jh = match client::connect(ssh_config.clone(), jump_addr.as_str(), jump_client).await {
                Ok(h) => h,
                Err(e) => {
                    pending_verify.lock().await.remove(&jump_session_id);
                    return Err(format!("Jump host connect: {}", e));
                }
            };

            pending_verify.lock().await.remove(&jump_session_id);

            // Authenticate to jump host
            Self::authenticate(&mut jh, &jump_username, &jump_auth).await
                .map_err(|e| format!("Jump host: {}", e))?;

            // Open direct-tcpip channel to target host through jump host
            let forwarded_channel = jh
                .channel_open_direct_tcpip(&config.host, config.port as u32, "127.0.0.1", 0)
                .await
                .map_err(|e| format!("Jump host forwarding failed: {}", e))?;

            // Create a TCP stream pair for the forwarded channel
            let (client_stream, server_stream) = tokio::io::duplex(DUPLEX_BUFFER_SIZE);

            // Spawn a task to bridge forwarded_channel <-> server_stream
            let mut fw_channel = forwarded_channel;
            let jump_forward_handle = tokio::spawn(async move {
                use tokio::io::{AsyncReadExt, AsyncWriteExt};
                let (mut read_half, mut write_half) = tokio::io::split(server_stream);
                let mut fw_buf = [0u8; FORWARD_BUFFER_SIZE];

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
                        n = read_half.read(&mut fw_buf) => {
                            match n {
                                Ok(0) | Err(_) => break,
                                Ok(n) => {
                                    if fw_channel.data(&fw_buf[..n]).await.is_err() {
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            });

            let target_client = SshClient::new(
                app_handle.clone(),
                session_id.clone(),
                config.host.clone(),
                config.port,
                known_hosts.clone(),
            );
            store_verify_tx(&pending_verify, &target_client, session_id.clone()).await;

            let target_handle = match client::connect_stream(ssh_config, client_stream, target_client).await {
                Ok(h) => h,
                Err(e) => {
                    pending_verify.lock().await.remove(&session_id);
                    jump_forward_handle.abort();
                    return Err(format!("Target connect via jump: {}", e));
                }
            };

            pending_verify.lock().await.remove(&session_id);

            jump_handle_opt = Some((jh, jump_forward_handle));
            target_handle
        } else {
            // Direct connection
            let direct_client = SshClient::new(
                app_handle.clone(),
                session_id.clone(),
                config.host.clone(),
                config.port,
                known_hosts.clone(),
            );
            store_verify_tx(&pending_verify, &direct_client, session_id.clone()).await;

            let addr = format!("{}:{}", config.host, config.port);
            let result = client::connect(ssh_config, addr.as_str(), direct_client).await;

            pending_verify.lock().await.remove(&session_id);
            result.map_err(|e| format!("connect: {}", e))?
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
        let (cmd_tx, cmd_rx) = mpsc::channel::<ChannelCommand>(CHANNEL_BUFFER_SIZE);

        // Send startup command after shell is ready
        if let Some(ref startup_cmd) = config.startup_command {
            let sanitized = startup_cmd.replace('\n', "").replace('\r', "");
            if !sanitized.is_empty() {
                let cmd = format!("{}\n", sanitized);
                let cmd_tx_clone = cmd_tx.clone();
                let startup_data = cmd.into_bytes();
                tokio::spawn(async move {
                    tokio::time::sleep(STARTUP_DELAY).await;
                    if let Err(e) = cmd_tx_clone.send(ChannelCommand::Data(startup_data)).await {
                        log::warn!("Failed to send startup command: {}", e);
                    }
                });
            }
        }

        let (jump_handle, jump_forward_task) =
            jump_handle_opt.map_or((None, None), |(jh, jfh)| (Some(jh), Some(jfh)));

        let session = SshSession {
            handle: Arc::new(Mutex::new(handle)),
            cmd_tx,
            jump_handle,
            jump_forward_task,
        };

        sessions.lock().await.insert(session_id.clone(), session);

        // Spawn the channel task — owns the Channel exclusively, no mutex needed
        let sid = session_id.clone();
        let app = app_handle.clone();
        let sessions_clone = sessions.clone();

        tokio::spawn(async move {
            Self::channel_task(channel, cmd_rx, sessions_clone.clone(), sid.clone(), app).await;
            // Ensure session cleanup even if channel_task returned early
            sessions_clone.lock().await.remove(&sid);
        });

        Ok(session_id)
    }

    async fn channel_task(
        mut channel: Channel<client::Msg>,
        mut cmd_rx: mpsc::Receiver<ChannelCommand>,
        _sessions: Arc<Mutex<HashMap<String, SshSession>>>,
        session_id: String,
        app_handle: AppHandle,
    ) {
        loop {
            tokio::select! {
                msg = channel.wait() => {
                    match msg {
                        Some(ChannelMsg::Data { ref data })
                        | Some(ChannelMsg::ExtendedData { ref data, ext: 1 }) => {
                            let payload = SshDataPayload {
                                session_id: session_id.clone(),
                                data: data.to_vec(),
                            };
                            if let Err(e) = app_handle.emit("ssh-data", &payload) {
                                log::error!("Failed to emit SSH event: {}", e);
                            }
                        }
                        Some(ChannelMsg::Eof) | Some(ChannelMsg::Close) | None => {
                            if let Err(e) = app_handle.emit(
                                "ssh-disconnect",
                                &SshDisconnectPayload {
                                    session_id: session_id.clone(),
                                    reason: "Connection closed".to_string(),
                                },
                            ) {
                                log::error!("Failed to emit SSH event: {}", e);
                            }
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
                            if let Err(e) = channel.window_change(cols, rows, 0, 0).await {
                                log::error!("Failed to resize PTY: {}", e);
                            }
                        }
                        Some(ChannelCommand::Close) | None => {
                            if let Err(e) = channel.eof().await {
                                log::warn!("Failed to send EOF: {}", e);
                            }
                            break;
                        }
                    }
                }
            }
        }
    }

    pub async fn test_connection(
        &self,
        config: ConnectionConfig,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let known_hosts = self.known_hosts.clone();
        let pending_verify = self.pending_verify.clone();
        tokio::time::timeout(
            SSH_CONNECT_TIMEOUT,
            Self::test_connection_inner(config, app_handle, known_hosts, pending_verify),
        )
        .await
        .map_err(|_| "Connection timeout".to_string())?
    }

    async fn test_connection_inner(
        config: ConnectionConfig,
        app_handle: AppHandle,
        known_hosts: Arc<KnownHostsStore>,
        pending_verify: Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>,
    ) -> Result<(), String> {
        let ssh_config = Arc::new(client::Config {
            inactivity_timeout: Some(Duration::from_secs(10)), // Short timeout for test
            ..Default::default()
        });

        let test_session_id = format!("test-{}", Uuid::new_v4());
        let client = SshClient::new(
            app_handle,
            test_session_id.clone(),
            config.host.clone(),
            config.port,
            known_hosts,
        );
        store_verify_tx(&pending_verify, &client, test_session_id.clone()).await;

        let addr = format!("{}:{}", config.host, config.port);
        let result = client::connect(ssh_config, addr.as_str(), client)
            .await
            .map_err(|e| format!("connect: {}", e));

        pending_verify.lock().await.remove(&test_session_id);
        let mut handle = result?;

        Self::authenticate(&mut handle, &config.username, &config.auth_method).await?;

        // Disconnect immediately — test successful
        let _ = handle
            .disconnect(Disconnect::ByApplication, "", "English")
            .await;

        Ok(())
    }

    async fn get_session_field<T>(
        &self,
        session_id: &str,
        f: impl FnOnce(&SshSession) -> T,
    ) -> Result<T, String> {
        let sessions = self.sessions.lock().await;
        let session = sessions
            .get(session_id)
            .ok_or_else(|| "Session not found".to_string())?;
        Ok(f(session))
    }

    pub async fn write(&self, session_id: &str, data: &[u8]) -> Result<(), String> {
        let tx = self.get_session_field(session_id, |s| s.cmd_tx.clone()).await?;
        tx.send(ChannelCommand::Data(data.to_vec()))
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
        let tx = self.get_session_field(session_id, |s| s.cmd_tx.clone()).await?;
        tx.send(ChannelCommand::Resize { cols, rows })
            .await
            .map_err(|_| "Session closed".to_string())?;
        Ok(())
    }

    pub async fn get_handle(
        &self,
        session_id: &str,
    ) -> Result<Arc<Mutex<client::Handle<SshClient>>>, String> {
        self.get_session_field(session_id, |s| s.handle.clone()).await
    }

    pub async fn exec(
        &self,
        session_id: &str,
        command: &str,
    ) -> Result<String, String> {
        let handle = self.get_session_field(session_id, |s| s.handle.clone()).await?;
        // Lock dropped here, other operations can proceed

        let handle_guard = handle.lock().await;
        let channel = handle_guard
            .channel_open_session()
            .await
            .map_err(|e| format!("Channel open failed: {}", e))?;
        drop(handle_guard);

        channel
            .exec(true, command)
            .await
            .map_err(|e| format!("Exec failed: {}", e))?;

        let max_output = MAX_EXEC_OUTPUT;
        let exec_future = async {
            let mut output = Vec::new();
            let mut ch = channel;
            loop {
                match ch.wait().await {
                    Some(ChannelMsg::Data { ref data })
                    | Some(ChannelMsg::ExtendedData { ref data, .. }) => {
                        output.extend_from_slice(data);
                        if output.len() > max_output {
                            output.truncate(max_output);
                            break;
                        }
                    }
                    Some(ChannelMsg::Eof) | Some(ChannelMsg::Close) | None => {
                        break;
                    }
                    _ => {}
                }
            }
            output
        };

        let output = tokio::time::timeout(SSH_EXEC_TIMEOUT, exec_future)
            .await
            .map_err(|_| "Exec timeout".to_string())?;

        Ok(String::from_utf8_lossy(&output).into_owned())
    }

    pub async fn disconnect(&self, session_id: &str) -> Result<(), String> {
        let session = {
            let mut sessions = self.sessions.lock().await;
            sessions.remove(session_id)
        };
        // Lock dropped, other operations can proceed
        if let Some(session) = session {
            if let Err(e) = session.cmd_tx.send(ChannelCommand::Close).await {
                log::error!("Failed to send close command: {}", e);
            }
            // Give channel_task time to send EOF before we tear down the transport
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            let handle = session.handle.lock().await;
            let _ = handle
                .disconnect(Disconnect::ByApplication, "", "English")
                .await;
            drop(handle);
            if let Some(task) = session.jump_forward_task {
                task.abort();
            }
            if let Some(jh) = session.jump_handle {
                let _ = jh
                    .disconnect(Disconnect::ByApplication, "", "English")
                    .await;
            }
        }
        Ok(())
    }
}
