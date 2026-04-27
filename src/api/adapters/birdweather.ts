import type { StationAdapter } from '../adapter';
import { fetchRecentRecords, fetchRecord, fetchRecordsForSpecies } from '../records';
import { fetchTopSpecies, fetchSpecies } from '../species';
import { fetchStats, fetchDailyCounts } from '../stats';

export function createBirdWeatherAdapter(stationId: string): StationAdapter {
  return {
    cacheKey: `bw:${stationId}`,
    fetchRecentRecords: (cursor) => fetchRecentRecords(stationId, cursor),
    fetchRecord,
    fetchRecordsForSpecies: (speciesId, limit) =>
      fetchRecordsForSpecies(stationId, speciesId, limit),
    fetchTopSpecies: (limit) => fetchTopSpecies(stationId, limit),
    fetchSpecies,
    fetchStats: () => fetchStats(stationId),
    fetchDailyCounts: (days) => fetchDailyCounts(stationId, days),
  };
}
