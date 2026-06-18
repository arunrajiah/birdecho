import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStationStore } from '../stores/stationStore';
import { useApiAdapter } from './useApiAdapter';
import { isRareAtStation } from '../lib/rarity';

/**
 * Returns a predicate `isRare(count)` that flags a species as rare relative to
 * the connected station's detection distribution.
 *
 * Backed by the same cached `topSpecies` query the Species tab uses (identical
 * queryKey), so screens that already render that list incur no extra fetch.
 * On screens that only have a single species (Favorites, species detail), this
 * reuses the cached list to recover the station's max detection count.
 */
export function useRarityChecker(): (count: number) => boolean {
  const adapter = useApiAdapter();
  const isConnected = useStationStore((s) => s.isConnected);

  const { data } = useQuery({
    queryKey: ['topSpecies', adapter?.cacheKey, 200],
    queryFn: () => adapter!.fetchTopSpecies(200),
    enabled: !!adapter && isConnected,
  });

  const maxCount = data && data.length > 0 ? Math.max(...data.map((s) => s.count)) : 0;
  const speciesCount = data?.length ?? 0;

  return useCallback(
    (count: number) => isRareAtStation(count, maxCount, speciesCount),
    [maxCount, speciesCount],
  );
}
