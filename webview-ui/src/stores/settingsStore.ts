import { create } from 'zustand';

interface SettingsState {
  customHttpMethods: string[];
  setCustomHttpMethods: (methods: string[]) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  customHttpMethods: [],
  setCustomHttpMethods: (methods) => set({ customHttpMethods: methods }),
}));
