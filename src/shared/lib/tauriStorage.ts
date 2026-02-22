import { load, type Store } from "@tauri-apps/plugin-store";
import type { StateStorage } from "zustand/middleware";

const storeCache = new Map<string, Store>();

async function getStore(name: string): Promise<Store> {
  let store = storeCache.get(name);
  if (!store) {
    store = await load(`${name}.json`, { defaults: {}, autoSave: true });
    storeCache.set(name, store);
  }
  return store;
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
