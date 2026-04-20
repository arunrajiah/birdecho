import { create } from 'zustand';
import * as secureStorage from '../lib/secureStorage';

interface StationState {
  stationId: string | null;
  stationName: string | null;
  loading: boolean;
  hydrate: () => Promise<void>;
  connect: (token: string, stationId: string, stationName: string) => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useStationStore = create<StationState>((set) => ({
  stationId: null,
  stationName: null,
  loading: false,

  hydrate: async () => {
    set({ loading: true });
    const stationId = await secureStorage.getStationId();
    set({ stationId, loading: false });
  },

  connect: async (token, stationId, stationName) => {
    await secureStorage.setToken(token);
    await secureStorage.setStationId(stationId);
    set({ stationId, stationName });
  },

  disconnect: async () => {
    await secureStorage.clearToken();
    await secureStorage.clearStationId();
    set({ stationId: null, stationName: null });
  },
}));
