import { invoke } from "@tauri-apps/api/core";

export function imeLogStart() {
  return invoke<string>("ime_log_start");
}

export function imeLogAppend(line: string) {
  return invoke<void>("ime_log_append", { line });
}

export function imeLogStop() {
  return invoke<void>("ime_log_stop");
}
