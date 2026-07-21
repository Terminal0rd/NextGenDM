import { create } from 'zustand';
import { AppSettings, AppSettingsUpdate } from '@/types/settings';
import { getSettings, updateSettings as tauriUpdateSettings } from '@/lib/tauri';

interface SettingsState {
  settings: AppSettings | null;
  isLoading: boolean;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  loadSettings: () => Promise<void>;
  updateSettings: (update: AppSettingsUpdate) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  isLoading: true,
  isOpen: false,
  setIsOpen: (isOpen) => set({ isOpen }),
  loadSettings: async () => {
    try {
      const settings = await getSettings();
      set({ settings, isLoading: false });
    } catch (e) {
      console.error('Failed to load settings:', e);
      set({ isLoading: false });
    }
  },
  updateSettings: async (update) => {
    try {
      const newSettings = await tauriUpdateSettings(update);
      set({ settings: newSettings });
    } catch (e) {
      console.error('Failed to update settings:', e);
    }
  },
}));
