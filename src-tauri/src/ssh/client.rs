use russh::keys::ssh_key::PublicKey;
use russh::client;
use tauri::AppHandle;

pub struct SshClient {
    #[allow(dead_code)]
    app_handle: AppHandle,
    #[allow(dead_code)]
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
        Ok(true)
    }

    // data() is intentionally NOT implemented here.
    // All SSH data is handled by channel_task in session.rs via ChannelMsg::Data.
    // Implementing data() here would cause double-emit of ssh-data events.
}
