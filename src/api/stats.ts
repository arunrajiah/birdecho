import { apiFetch } from '../lib/apiClient';
import type { Stats } from '../types/birdweather';

/**
 * BirdWeather station stats: { success, detections, species } for a period
 * (day | week | month | all). The period defaults to `day`, so all-time totals
 * must ask for `period=all` explicitly. There is no daily-counts endpoint in the
 * REST v1 API, so the daily chart is a today-only stub.
 *
 * Note: `?period=` is ignored by the /detections endpoint (it returns the latest
 * rows regardless of date), so never count "today" from a detections page.
 */
async function fetchPeriodStats(
  stationId: string,
  period: 'day' | 'all',
): Promise<{ detections?: number; species?: number }> {
  return apiFetch<{ detections?: number; species?: number }>(
    `/stations/${stationId}/stats?period=${period}`,
  );
}

export async function fetchStats(stationId: string): Promise<Stats> {
  const data = await fetchPeriodStats(stationId, 'all');
  let recordsToday = 0;
  try {
    recordsToday = (await fetchPeriodStats(stationId, 'day')).detections ?? 0;
  } catch {
    // best-effort — leave today at 0 rather than failing the whole stats screen
  }
  return {
    totalRecords: data.detections ?? 0,
    uniqueSpecies: data.species ?? 0,
    recordsToday,
  };
}

export async function fetchDailyCounts(
  stationId: string,
  days: number,
): Promise<{ date: string; count: number }[]> {
  // BirdWeather REST has no daily-count endpoint; populate today only and
  // zero-fill the rest so the chart renders consistently.
  const today = new Date().toISOString().slice(0, 10);
  let todayCount = 0;
  try {
    todayCount = (await fetchPeriodStats(stationId, 'day')).detections ?? 0;
  } catch {
    // ignore — chart simply shows zeros
  }
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const ds = d.toISOString().slice(0, 10);
    return { date: ds, count: ds === today ? todayCount : 0 };
  });
}
