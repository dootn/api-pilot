import { create } from 'zustand';

interface UIState {
  importModalOpen: boolean;
  openImportModal: () => void;
  closeImportModal: () => void;
  setImportModalOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  importModalOpen: false,
  openImportModal: () => set({ importModalOpen: true }),
  closeImportModal: () => set({ importModalOpen: false }),
  setImportModalOpen: (open) => set({ importModalOpen: open }),
}));
