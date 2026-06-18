import { apiFetch } from '../lib/apiClient';
import type { Stats } from '../types/birdweather';

/**
 * BirdWeather station stats: { success, detections, species } — all-time totals.
 * There is no per-day stats variant and no daily-counts endpoint in the REST v1
 * API, so "today" is derived by counting detections with ?period=day (one page,
 * capped at 100), and the daily chart is a today-only stub.
 */
export async function fetchStats(stationId: string): Promise<Stats> {
  const data = await apiFetch<{ detections?: number; species?: number }>(
    `/stations/${stationId}/stats`,
  );
  let recordsToday = 0;
  try {
    const today = await apiFetch<{ detections?: unknown[] }>(
      `/stations/${stationId}/detections?period=day&limit=100`,
    );
    recordsToday = today.detections?.length ?? 0;
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
  // BirdWeather REST has no daily-count endpoint; populate today only (counted
  // from ?period=day) and zero-fill the rest so the chart renders consistently.
  const today = new Date().toISOString().slice(0, 10);
  let todayCount = 0;
  try {
    const r = await apiFetch<{ detections?: unknown[] }>(
      `/stations/${stationId}/detections?period=day&limit=100`,
    );
    todayCount = r.detections?.length ?? 0;
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
