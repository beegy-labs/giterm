use std::collections::HashMap;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::Mutex;
use russh::client;

use super::client::SshClient;

struct ActiveTunnel {
    cancel_tx: tokio::sync::oneshot::Sender<()>,
}

pub struct TunnelManager {
    tunnels: Arc<Mutex<HashMap<String, ActiveTunnel>>>,
}

impl TunnelManager {
    pub fn new() -> Self {
        Self {
            tunnels: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn start_tunnel(
        &self,
        tunnel_id: String,
        session_handle: Arc<Mutex<client::Handle<SshClient>>>,
        local_port: u16,
        remote_host: String,
        remote_port: u16,
    ) -> Result<(), String> {
        let listener = TcpListener::bind(format!("127.0.0.1:{}", local_port))
            .await
            .map_err(|e| format!("Failed to bind port {}: {}", local_port, e))?;

        let (cancel_tx, mut cancel_rx) = tokio::sync::oneshot::channel::<()>();

        self.tunnels.lock().await.insert(
            tunnel_id.clone(),
            ActiveTunnel { cancel_tx },
        );

        let tunnels = self.tunnels.clone();
        let tid = tunnel_id.clone();

        tokio::spawn(async move {
            loop {
                tokio::select! {
                    accept_result = listener.accept() => {
                        match accept_result {
                            Ok((tcp_stream, _)) => {
                                let handle = session_handle.clone();
                                let rhost = remote_host.clone();

                                tokio::spawn(async move {
                                    if let Err(e) = Self::handle_connection(
                                        handle, tcp_stream, &rhost, remote_port,
                                    ).await {
                                        log::error!("Tunnel connection error: {}", e);
                                    }
                                });
                            }
                            Err(e) => {
                                log::error!("Tunnel accept error: {}", e);
                                break;
                            }
                        }
                    }
                    _ = &mut cancel_rx => {
                        break;
                    }
                }
            }
            // Cleanup: remove tunnel from map after loop exits (cancel or error)
            tunnels.lock().await.remove(&tid);
        });

        Ok(())
    }

    async fn handle_connection(
        handle: Arc<Mutex<client::Handle<SshClient>>>,
        tcp_stream: tokio::net::TcpStream,
        remote_host: &str,
        remote_port: u16,
    ) -> Result<(), String> {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        use russh::ChannelMsg;

        let h = handle.lock().await;
        let mut channel = h
            .channel_open_direct_tcpip(remote_host, remote_port as u32, "127.0.0.1", 0)
            .await
            .map_err(|e| format!("Direct-tcpip failed: {}", e))?;
        drop(h);

        let (mut tcp_read, mut tcp_write) = tcp_stream.into_split();
        let mut buf = [0u8; 8192];

        loop {
            tokio::select! {
                msg = channel.wait() => {
                    match msg {
                        Some(ChannelMsg::Data { ref data }) => {
                            if tcp_write.write_all(data).await.is_err() {
                                break;
                            }
                        }
                        Some(ChannelMsg::Eof) | Some(ChannelMsg::Close) | None => {
                            break;
                        }
                        _ => {}
                    }
                }
                n = tcp_read.read(&mut buf) => {
                    match n {
                        Ok(0) | Err(_) => break,
                        Ok(n) => {
                            if channel.data(&buf[..n]).await.is_err() {
                                break;
                            }
                        }
                    }
                }
            }
        }

        Ok(())
    }

    pub async fn stop_tunnel(&self, tunnel_id: &str) -> Result<(), String> {
        let mut tunnels = self.tunnels.lock().await;
        if let Some(tunnel) = tunnels.remove(tunnel_id) {
            let _ = tunnel.cancel_tx.send(());
        }
        Ok(())
    }
}
