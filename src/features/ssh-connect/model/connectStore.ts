import { create } from "zustand";
import type { ConnectionConfig } from "@/entities/connection";

interface ConnectDialogState {
  open: boolean;
  editingConnection: ConnectionConfig | null;
  setOpen: (open: boolean) => void;
  openEdit: (connection: ConnectionConfig) => void;
}

export const useConnectDialogStore = create<ConnectDialogState>()((set) => ({
  open: false,
  editingConnection: null,
  setOpen: (open) => set((state) => ({ open, editingConnection: open ? state.editingConnection : null })),
  openEdit: (connection) => set({ open: true, editingConnection: connection }),
}));
