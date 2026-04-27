import type { Detection, RecordsPage, Species, Stats } from '../types/birdweather';

/**
 * StationAdapter abstracts the data source so screens are identical
 * whether the user connects via BirdWeather or directly to a BirdNET-Go instance.
 */
export interface StationAdapter {
  /** Unique key used as the React Query cache key prefix */
  cacheKey: string;

  fetchRecentRecords(cursor?: string): Promise<RecordsPage>;
  fetchRecord(id: string): Promise<Detection>;
  fetchRecordsForSpecies(speciesId: string, limit?: number): Promise<Detection[]>;
  fetchTopSpecies(limit: number): Promise<Species[]>;
  fetchSpecies(id: string): Promise<Species>;
  fetchStats(): Promise<Stats>;
  fetchDailyCounts(days: number): Promise<{ date: string; count: number }[]>;
}
