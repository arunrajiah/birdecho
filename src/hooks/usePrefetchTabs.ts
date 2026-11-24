import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiAdapter } from './useApiAdapter';
import { useStationStore } from '../stores/stationStore';
import { useFavoritesStore } from '../stores/favoritesStore';

/** Wait after the app opens before loading the other tabs, so the Feed gets the station to itself first. */
const START_DELAY_MS = 3_000;

/**
 * Loads the Species, Stats and Favorites tabs in the background once the Feed is up, so switching tabs shows data
 * at once instead of waiting on the station (a busy BirdNET-Pi can take 10 s or more per page). The query keys and
 * functions match the tab screens exactly. One request at a time: a small Pi renders PHP pages one or two at a time.
 * Fresh entries (within staleTime) are skipped by prefetchQuery, so this costs nothing when the cache is warm.
 */
export function usePrefetchTabs() {
  const queryClient = useQueryClient();
  const adapter = useApiAdapter();
  const isConnected = useStationStore((s) => s.isConnected);
  const favorites = useFavoritesStore((s) => s.speciesIds);

  useEffect(() => {
    if (!adapter || !isConnected) return;
    let cancelled = false;
    const key = adapter.cacheKey;
    const timer = setTimeout(async () => {
      const steps: [readonly unknown[], () => Promise<unknown>][] = [
        [['topSpecies', key, 200], () => adapter.fetchTopSpecies(200)],
        [['stats', key], () => adapter.fetchStats()],
        [['topSpecies', key, 10], () => adapter.fetchTopSpecies(10)],
        [['daily', key], () => adapter.fetchDailyCounts(14)],
        ...favorites.map((id): [readonly unknown[], () => Promise<unknown>] => [[key, 'species', id], () => adapter.fetchSpecies(id)]),
      ];
      for (const [queryKey, queryFn] of steps) {
        if (cancelled) return;
        // prefetchQuery never throws; a failed step leaves that tab to load (and show its error) as before.
        await queryClient.prefetchQuery({ queryKey, queryFn, retry: false });
      }
    }, START_DELAY_MS);
    return () => { cancelled = true; clearTimeout(timer); };
    // Favourites are read when the run starts; adding one later loads it on the Favorites tab as before.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, isConnected, queryClient]);
}
