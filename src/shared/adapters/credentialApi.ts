import { invoke } from "@tauri-apps/api/core";

export async function credentialStore(
  connectionId: string,
  field: string,
  secret: string,
): Promise<void> {
  return invoke("credential_store", { connectionId, field, secret });
}

export async function credentialGet(
  connectionId: string,
  field: string,
): Promise<string | null> {
  return invoke("credential_get", { connectionId, field });
}

export async function credentialDeleteAll(
  connectionId: string,
): Promise<void> {
  return invoke("credential_delete_all", { connectionId });
}
