import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'favorites';

interface FavoritesState {
  speciesIds: string[];
  hydrate: () => Promise<void>;
  add: (id: string) => void;
  remove: (id: string) => void;
  toggle: (id: string) => void;
  has: (id: string) => boolean;
}

function persist(ids: string[]) {
  SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(ids)).catch(() => {});
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  speciesIds: [],

  hydrate: async () => {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (raw) {
      try {
        set({ speciesIds: JSON.parse(raw) as string[] });
      } catch {
        // ignore corrupt data
      }
    }
  },

  add: (id) =>
    set((state) => {
      if (state.speciesIds.includes(id)) return state;
      const updated = [...state.speciesIds, id];
      persist(updated);
      return { speciesIds: updated };
    }),

  remove: (id) =>
    set((state) => {
      const updated = state.speciesIds.filter((s) => s !== id);
      persist(updated);
      return { speciesIds: updated };
    }),

  toggle: (id) => {
    if (get().has(id)) {
      get().remove(id);
    } else {
      get().add(id);
    }
  },

  has: (id) => get().speciesIds.includes(id),
}));
