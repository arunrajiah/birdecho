import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const RARE_ALERTS_KEY = 'rare_alerts_enabled';

interface SettingsState {
  /** When true, a local notification fires the first time each rare species is detected per day. */
  rareAlertsEnabled: boolean;
  hydrate: () => Promise<void>;
  setRareAlerts: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  rareAlertsEnabled: false,

  hydrate: async () => {
    const stored = await SecureStore.getItemAsync(RARE_ALERTS_KEY);
    if (stored === 'true') set({ rareAlertsEnabled: true });
  },

  setRareAlerts: (enabled) => {
    SecureStore.setItemAsync(RARE_ALERTS_KEY, enabled ? 'true' : 'false').catch(() => {});
    set({ rareAlertsEnabled: enabled });
  },
}));
