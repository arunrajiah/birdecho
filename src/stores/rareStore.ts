import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Species the user has manually marked as "rare". Replaces the old auto-by-count
// heuristic (which mislabelled common-but-infrequent birds as rare — issue #24).
const STORAGE_KEY = 'rare_species';

interface RareState {
  speciesIds: string[];
  hydrate: () => Promise<void>;
  add: (id: string) => void;
  remove: (id: string) => void;
  toggle: (id: string) => void;
  has: (id: string) => boolean;
}

function persist(ids: string[]) {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids)).catch(() => {});
}

export const useRareStore = create<RareState>((set, get) => ({
  speciesIds: [],

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
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
    if (get().has(id)) get().remove(id);
    else get().add(id);
  },

  has: (id) => get().speciesIds.includes(id),
}));
