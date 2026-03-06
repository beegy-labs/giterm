import { create } from "zustand";
import type { HostKeyVerifyPayload } from "../adapters/events/sshEventAdapter";

interface HostKeyVerifyState {
  request: HostKeyVerifyPayload | null;
  setRequest: (req: HostKeyVerifyPayload | null) => void;
}

export const useHostKeyVerifyStore = create<HostKeyVerifyState>((set) => ({
  request: null,
  setRequest: (request) => set({ request }),
}));
