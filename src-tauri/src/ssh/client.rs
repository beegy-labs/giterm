use russh::keys::ssh_key::PublicKey;
use russh::{client, ChannelId};
use tauri::{AppHandle, Emitter};

use super::types::SshDataPayload;

pub struct SshClient {
    app_handle: AppHandle,
    session_id: String,
}

impl SshClient {
    pub fn new(app_handle: AppHandle, session_id: String) -> Self {
        Self {
            app_handle,
            session_id,
        }
    }
}

impl client::Handler for SshClient {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        // TOFU (Trust On First Use) — accept all keys for now
        // TODO: Implement known_hosts verification
        Ok(true)
    }

    async fn data(
        &mut self,
        _channel: ChannelId,
        data: &[u8],
        _session: &mut client::Session,
    ) -> Result<(), Self::Error> {
        let payload = SshDataPayload {
            session_id: self.session_id.clone(),
            data: data.to_vec(),
        };
        let _ = self.app_handle.emit("ssh-data", &payload);
        Ok(())
    }
}
