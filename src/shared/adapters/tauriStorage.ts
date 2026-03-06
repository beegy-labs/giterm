import { load, type Store } from "@tauri-apps/plugin-store";
import type { StateStorage } from "zustand/middleware";

const storeCache = new Map<string, Promise<Store>>();

function getStore(name: string): Promise<Store> {
  let storePromise = storeCache.get(name);
  if (!storePromise) {
    storePromise = load(`${name}.json`, { defaults: {}, autoSave: true });
    storeCache.set(name, storePromise);
  }
  return storePromise;
}

/**
 * Zustand persist storage adapter backed by tauri-plugin-store.
 * Falls back to localStorage if Tauri is not available (e.g., browser dev).
 */
export const tauriStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const store = await getStore(name);
      const value = await store.get<string>("data");
      return value ?? null;
    } catch {
      return localStorage.getItem(name);
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      const store = await getStore(name);
      await store.set("data", value);
    } catch {
      localStorage.setItem(name, value);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      const store = await getStore(name);
      await store.delete("data");
    } catch {
      localStorage.removeItem(name);
    }
  },
};
