import { invoke } from "@tauri-apps/api/core";

const IS_DEV = import.meta.env.DEV;

export function vpLogStart(): Promise<string> {
  if (!IS_DEV) return Promise.resolve("");
  return invoke<string>("vp_log_start");
}

export function vpLogAppend(line: string): void {
  if (!IS_DEV) return;
  invoke<void>("vp_log_append", { line }).catch(() => {});
}

export function vpLogStop(): Promise<void> {
  if (!IS_DEV) return Promise.resolve();
  return invoke<void>("vp_log_stop");
}
