import { create } from 'zustand';
import * as secureStorage from '../lib/secureStorage';

interface StationState {
  stationId: string | null;
  stationName: string | null;
  stationTimezone: string | null;
  loading: boolean;
  hydrate: () => Promise<void>;
  connect: (token: string, stationId: string, stationName: string, timezone?: string) => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useStationStore = create<StationState>((set) => ({
  stationId: null,
  stationName: null,
  stationTimezone: null,
  loading: false,

  hydrate: async () => {
    set({ loading: true });
    const stationId = await secureStorage.getStationId();
    const stationTimezone = await secureStorage.getTimezone();
    set({ stationId, stationTimezone, loading: false });
  },

  connect: async (token, stationId, stationName, timezone) => {
    await secureStorage.setToken(token);
    await secureStorage.setStationId(stationId);
    if (timezone) await secureStorage.setTimezone(timezone);
    set({ stationId, stationName, stationTimezone: timezone ?? null });
  },

  disconnect: async () => {
    await secureStorage.clearToken();
    await secureStorage.clearStationId();
    await secureStorage.clearTimezone();
    set({ stationId: null, stationName: null, stationTimezone: null });
  },
}));
