import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

type ColorMode = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'theme_mode';

interface ThemeState {
  mode: ColorMode;
  hydrate: () => Promise<void>;
  setMode: (mode: ColorMode) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'system',

  hydrate: async () => {
    const stored = await SecureStore.getItemAsync(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      set({ mode: stored });
    }
  },

  setMode: (mode) => {
    SecureStore.setItemAsync(STORAGE_KEY, mode).catch(() => {});
    set({ mode });
  },
}));
