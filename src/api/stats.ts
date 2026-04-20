import { apiFetch } from '../lib/apiClient';
import type { Stats } from '../types/birdweather';

export async function fetchStats(stationId: string): Promise<Stats> {
  const data = await apiFetch<{ stats: Stats }>(`/stations/${stationId}/stats`);
  return data.stats;
}

export async function fetchDailyCounts(
  stationId: string,
  days: number,
): Promise<{ date: string; count: number }[]> {
  const data = await apiFetch<{ daily: { date: string; count: number }[] }>(
    `/stations/${stationId}/daily?days=${days}`,
  );
  return data.daily;
}
