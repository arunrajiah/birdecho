import { apiFetch } from '../lib/apiClient';
import { getToken } from '../lib/secureStorage';
import type { Stats } from '../types/birdweather';

const GRAPHQL_URL = 'https://app.birdweather.com/graphql';

/**
 * BirdWeather station stats: { success, detections, species } for a period
 * (day | week | month | all). The period defaults to `day`, so all-time totals
 * must ask for `period=all` explicitly. There is no daily-counts endpoint in the
 * REST v1 API, so the daily chart uses the GraphQL API (see fetchDailyTotals).
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
  // Prefer the calendar-day total (same source as the daily chart, so the two
  // agree); REST `period=day` is a rolling 24 hours.
  let recordsToday = 0;
  try {
    const latest = (await fetchDailyTotals(stationId, 1)).sort((a, b) =>
      a.date < b.date ? 1 : -1,
    )[0];
    if (!latest) throw new Error('no daily totals');
    recordsToday = latest.total;
  } catch {
    try {
      recordsToday = (await fetchPeriodStats(stationId, 'day')).detections ?? 0;
    } catch {
      // best-effort — leave today at 0 rather than failing the whole stats screen
    }
  }
  return {
    totalRecords: data.detections ?? 0,
    uniqueSpecies: data.species ?? 0,
    recordsToday,
  };
}

/**
 * Per-day totals come from BirdWeather's public GraphQL API; REST v1 has no
 * equivalent. Dates are calendar days in the station's timezone.
 */
async function fetchDailyTotals(
  stationId: string,
  days: number,
): Promise<{ date: string; total: number }[]> {
  const token = await getToken();
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Auth-Token': token } : {}),
    },
    body: JSON.stringify({
      query:
        'query($ids:[ID!],$p:InputDuration){dailyDetectionCounts(stationIds:$ids,period:$p){date total}}',
      variables: { ids: [stationId], p: { count: days, unit: 'day' } },
    }),
  });
  if (!response.ok) throw new Error(`BirdWeather GraphQL error ${response.status}`);
  const json = (await response.json()) as {
    data?: { dailyDetectionCounts?: { date: string; total: number }[] };
  };
  const rows = json.data?.dailyDetectionCounts;
  if (!Array.isArray(rows)) throw new Error('BirdWeather GraphQL returned no daily counts');
  return rows;
}

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function fetchDailyCounts(
  stationId: string,
  days: number,
): Promise<{ date: string; count: number }[]> {
  const counts: Record<string, number> = {};
  let end = localYmd(new Date());
  try {
    for (const row of await fetchDailyTotals(stationId, days + 1)) {
      counts[row.date] = row.total;
      // Anchor the chart on the station's latest day, which may differ from the phone's.
      if (row.date > end) end = row.date;
    }
  } catch {
    // Fall back to today only so the chart still renders.
    try {
      counts[end] = (await fetchPeriodStats(stationId, 'day')).detections ?? 0;
    } catch {
      // ignore — chart simply shows zeros
    }
  }
  const [y, m, d] = end.split('-').map(Number);
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(y!, m! - 1, d! - (days - 1 - i));
    const key = localYmd(day);
    return { date: key, count: counts[key] ?? 0 };
  });
}
