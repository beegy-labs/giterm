import { create } from "zustand";

interface AppState {
  sidebarOpen: boolean;
  connectionDialogOpen: boolean;
  toggleSidebar: () => void;
  setConnectionDialogOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  sidebarOpen: true,
  connectionDialogOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setConnectionDialogOpen: (open) => set({ connectionDialogOpen: open }),
}));
