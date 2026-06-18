import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStationStore } from '../stores/stationStore';
import { useApiAdapter } from './useApiAdapter';
import { isRareAtStation } from '../lib/rarity';

export interface RarityChecker {
  /** True if a species with this detection count is rare at the connected station. */
  isRare: (count: number) => boolean;
  /** True if the species with this id is rare. Resolves the count from the cached species list. */
  isRareSpecies: (speciesId: string) => boolean;
}

/**
 * Rarity helpers relative to the connected station's detection distribution.
 *
 * Backed by the same cached `topSpecies` query the Species tab uses (identical
 * queryKey), so screens that already render that list incur no extra fetch.
 * `isRareSpecies` lets callers that only have a species id (e.g. the feed, whose
 * detections carry no count) check rarity by looking the id up in that list.
 */
export function useRarityChecker(): RarityChecker {
  const adapter = useApiAdapter();
  const isConnected = useStationStore((s) => s.isConnected);

  const { data } = useQuery({
    queryKey: ['topSpecies', adapter?.cacheKey, 200],
    queryFn: () => adapter!.fetchTopSpecies(200),
    enabled: !!adapter && isConnected,
  });

  const maxCount = data && data.length > 0 ? Math.max(...data.map((s) => s.count)) : 0;
  const speciesCount = data?.length ?? 0;

  // Precompute the set of rare species ids once per list change.
  const rareIds = useMemo(() => {
    const set = new Set<string>();
    if (data) {
      for (const s of data) {
        if (isRareAtStation(s.count, maxCount, speciesCount)) set.add(s.id);
      }
    }
    return set;
  }, [data, maxCount, speciesCount]);

  const isRare = useCallback(
    (count: number) => isRareAtStation(count, maxCount, speciesCount),
    [maxCount, speciesCount],
  );

  const isRareSpecies = useCallback((speciesId: string) => rareIds.has(speciesId), [rareIds]);

  return { isRare, isRareSpecies };
}
