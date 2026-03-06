use russh::keys::ssh_key::PublicKey;
use russh::client;
use tokio::sync::oneshot;
use tauri::{AppHandle, Emitter};
use std::sync::{Arc, Mutex};
use serde::Serialize;

use super::known_hosts::{KnownHostsStore, HostKeyStatus};

/// Payload emitted to the frontend when host key verification is needed.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HostKeyVerifyRequest {
    pub session_id: String,
    pub host: String,
    pub port: u16,
    pub fingerprint: String,
    /// "unknown" or "changed"
    pub status: String,
    pub old_fingerprint: Option<String>,
}

pub struct SshClient {
    app_handle: AppHandle,
    session_id: String,
    host: String,
    port: u16,
    known_hosts: Arc<KnownHostsStore>,
    /// Channel to send back the user's accept/reject decision.
    /// Wrapped in Mutex<Option<>> so it can be taken once from the async handler.
    verify_tx: Mutex<Option<oneshot::Sender<bool>>>,
    verify_rx: Mutex<Option<oneshot::Receiver<bool>>>,
}

impl SshClient {
    pub fn new(
        app_handle: AppHandle,
        session_id: String,
        host: String,
        port: u16,
        known_hosts: Arc<KnownHostsStore>,
    ) -> Self {
        let (tx, rx) = oneshot::channel();
        Self {
            app_handle,
            session_id,
            host,
            port,
            known_hosts,
            verify_tx: Mutex::new(Some(tx)),
            verify_rx: Mutex::new(Some(rx)),
        }
    }

    /// Called from the connect command to resolve a pending host key verification.
    /// The frontend sends back the user's decision via a Tauri command.
    pub fn take_verify_tx(&self) -> Option<oneshot::Sender<bool>> {
        self.verify_tx.lock().unwrap_or_else(|e| e.into_inner()).take()
    }
}

impl client::Handler for SshClient {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        let status = self.known_hosts.check(&self.host, self.port, server_public_key)
            .map_err(|e| {
                log::error!("Host key check failed: {}", e);
                russh::Error::Keys(russh::keys::Error::CouldNotReadKey)
            })?;
        let payload = match status {
            HostKeyStatus::Known => return Ok(true),
            HostKeyStatus::Unknown { fingerprint } => HostKeyVerifyRequest {
                session_id: self.session_id.clone(),
                host: self.host.clone(),
                port: self.port,
                fingerprint,
                status: "unknown".to_string(),
                old_fingerprint: None,
            },
            HostKeyStatus::Changed { old_fingerprint, new_fingerprint } => HostKeyVerifyRequest {
                session_id: self.session_id.clone(),
                host: self.host.clone(),
                port: self.port,
                fingerprint: new_fingerprint,
                status: "changed".to_string(),
                old_fingerprint: Some(old_fingerprint),
            },
        };

        if let Err(e) = self.app_handle.emit("ssh-host-key-verify", &payload) {
            log::error!("Failed to emit ssh-host-key-verify: {}", e);
        }

        let rx = self.verify_rx.lock().unwrap_or_else(|e| e.into_inner()).take();
        if let Some(rx) = rx {
            match rx.await {
                Ok(true) => {
                    if let Err(e) = self.known_hosts.accept(&self.host, self.port, server_public_key) {
                        log::error!("Failed to accept host key: {}", e);
                    }
                    Ok(true)
                }
                _ => Ok(false),
            }
        } else {
            Ok(false)
        }
    }

    // data() is intentionally NOT implemented here.
    // All SSH data is handled by channel_task in session.rs via ChannelMsg::Data.
    // Implementing data() here would cause double-emit of ssh-data events.
}
