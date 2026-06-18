/**
 * BirdNET-Go direct HTTP adapter.
 *
 * Talks to a locally-hosted BirdNET-Go instance via its public /api/v2 REST API.
 * Most read endpoints require no authentication, so no token is needed.
 *
 * API reference: https://github.com/tphakala/birdnet-go/blob/main/internal/api/v2/README.md
 */

import { ApiError } from '../../lib/apiClient';
import type { StationAdapter } from '../adapter';
import type { Detection, RecordsPage, Species, Stats } from '../../types/birdweather';

// ── BirdNET-Go DTO types ────────────────────────────────────────────────────

interface BngDetection {
  id: number;
  timestamp: string;
  commonName: string;
  scientificName: string;
  speciesCode?: string;
  confidence: number;
  clipName?: string;
}

interface BngPaginated {
  data: BngDetection[];
  total: number;
  limit: number;
  offset: number;
}

interface BngSpeciesSummary {
  scientific_name: string;
  common_name: string;
  species_code?: string;
  count: number;
  thumbnail_url?: string;
}

// /api/v2/analytics/time/daily requires a start_date (and optional end_date) and
// returns { start_date, end_date, data: [{date, count}], total }. There is NO
// `days` parameter — sending one yields a 400.
interface BngDailyResponse {
  start_date: string;
  end_date: string;
  data: { date: string; count: number }[];
  total: number;
}

// ── Low-level fetch ─────────────────────────────────────────────────────────

async function bngFetch<T>(base: string, path: string): Promise<T> {
  const url = `${base}/api/v2${path}`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error('Could not reach BirdNET-Go station — check the host URL and your network.');
  }
  if (!response.ok) {
    throw new ApiError(response.status, `BirdNET-Go error ${response.status}`);
  }
  const ct = response.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    throw new Error('Unexpected response from BirdNET-Go station — is the host URL correct?');
  }
  return response.json() as Promise<T>;
}

// ── Mapping helpers ─────────────────────────────────────────────────────────

function speciesId(d: BngDetection): string {
  return d.speciesCode ?? d.scientificName;
}

function mapDetection(d: BngDetection, base: string): Detection {
  return {
    id: String(d.id),
    speciesId: speciesId(d),
    commonName: d.commonName,
    scientificName: d.scientificName,
    timestamp: d.timestamp,
    confidence: d.confidence,
    soundscapeUrl: d.clipName
      ? `${base}/api/v2/media/audio/${encodeURIComponent(d.clipName)}`
      : undefined,
    imageUrl: `${base}/api/v2/media/image/${encodeURIComponent(d.scientificName)}`,
  };
}

function mapSpecies(s: BngSpeciesSummary, base: string): Species {
  return {
    id: s.species_code ?? s.scientific_name,
    commonName: s.common_name,
    scientificName: s.scientific_name,
    // Always use the media/image proxy (same endpoint detection rows use and
    // which loads reliably). The summary's thumbnail_url is often an unloadable
    // value, and `?? ` wouldn't catch an empty/relative string, so don't use it.
    imageUrl: `${base}/api/v2/media/image/${encodeURIComponent(s.scientific_name)}`,
    count: s.count,
  };
}

/** Local calendar date as YYYY-MM-DD (BirdNET-Go analytics are keyed by date). */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Adapter factory ─────────────────────────────────────────────────────────

export function createBirdNetGoAdapter(hostUrl: string): StationAdapter {
  const base = hostUrl.replace(/\/$/, '');

  return {
    cacheKey: `bng:${base}`,

    async fetchRecentRecords(cursor?: string): Promise<RecordsPage> {
      const offset = cursor ? parseInt(cursor, 10) : 0;
      const limit = 50;
      const data = await bngFetch<BngPaginated>(
        base,
        `/detections?limit=${limit}&offset=${offset}&order=desc`,
      );
      const records = data.data.map((d) => mapDetection(d, base));
      const nextOffset = offset + records.length;
      return {
        records,
        cursor: nextOffset < data.total ? String(nextOffset) : undefined,
      };
    },

    async fetchRecord(id: string): Promise<Detection> {
      const data = await bngFetch<BngDetection>(base, `/detections/${id}`);
      return mapDetection(data, base);
    },

    async fetchRecordsForSpecies(speciesId: string, limit = 10): Promise<Detection[]> {
      // Use search endpoint — supports scientific_name and species_code filtering
      const params = new URLSearchParams({
        limit: String(limit),
        scientific_name: speciesId,
        order: 'desc',
      });
      const data = await bngFetch<BngPaginated>(base, `/detections?${params}`);
      return data.data.map((d) => mapDetection(d, base));
    },

    async fetchTopSpecies(limit: number): Promise<Species[]> {
      const data = await bngFetch<BngSpeciesSummary[]>(
        base,
        `/analytics/species/summary?limit=${limit}`,
      );
      return data.map((s) => mapSpecies(s, base));
    },

    async fetchSpecies(id: string): Promise<Species> {
      const data = await bngFetch<BngSpeciesSummary[]>(base, `/analytics/species/summary`);
      const match = data.find((s) => s.species_code === id || s.scientific_name === id);
      if (!match) throw new Error(`Species not found: ${id}`);
      return mapSpecies(match, base);
    },

    async fetchStats(): Promise<Stats> {
      const today = ymd(new Date());
      const [summaryResult, dailyResult] = await Promise.allSettled([
        bngFetch<BngSpeciesSummary[]>(base, `/analytics/species/summary`),
        bngFetch<BngDailyResponse>(
          base,
          `/analytics/time/daily?start_date=${today}&end_date=${today}`,
        ),
      ]);
      // Surface error only if both calls failed — partial data is better than an error screen.
      if (summaryResult.status === 'rejected' && dailyResult.status === 'rejected') {
        throw summaryResult.reason;
      }
      const summary = summaryResult.status === 'fulfilled' ? summaryResult.value : [];
      // `total` is today's detection count for a single-day range.
      const recordsToday = dailyResult.status === 'fulfilled' ? dailyResult.value.total : 0;
      return {
        totalRecords: summary.reduce((n, s) => n + s.count, 0),
        uniqueSpecies: summary.length,
        recordsToday,
      };
    },

    async fetchDailyCounts(days: number): Promise<{ date: string; count: number }[]> {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - (days - 1));
      let res: BngDailyResponse;
      try {
        res = await bngFetch<BngDailyResponse>(
          base,
          `/analytics/time/daily?start_date=${ymd(start)}&end_date=${ymd(end)}`,
        );
      } catch {
        return [];
      }
      // Zero-fill missing days so the chart shows a continuous series.
      const counts: Record<string, number> = {};
      for (const d of res.data ?? []) counts[d.date] = d.count;
      return Array.from({ length: days }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const key = ymd(d);
        return { date: key, count: counts[key] ?? 0 };
      });
    },
  };
}

/**
 * Verify a BirdNET-Go host is reachable by calling GET /api/v2/ping.
 * Resolves with the host's station name (from /api/v2/settings/dashboard) if available,
 * or undefined on success without a name.
 *
 * Uses a raw fetch for the liveness probe — /api/v2/ping returns plain text ("pong"),
 * not JSON, so bngFetch (which enforces Content-Type: application/json) would throw a
 * false "Unexpected response" error even when the station is perfectly reachable.
 */
export async function pingBirdNetGo(hostUrl: string): Promise<string | undefined> {
  const base = hostUrl.replace(/\/$/, '');
  let response: Response;
  try {
    response = await fetch(`${base}/api/v2/ping`);
  } catch {
    throw new Error(
      'Could not reach the BirdNET-Go station — check the host URL and that your phone is on the same network.',
    );
  }
  if (!response.ok) {
    throw new Error(
      `BirdNET-Go station responded with HTTP ${response.status}. Check the URL and try again.`,
    );
  }
  // Best-effort: try to get an instance name from dashboard settings (public JSON endpoint)
  try {
    const settings = await bngFetch<{ node_name?: string }>(base, `/settings/dashboard`);
    return settings.node_name ?? undefined;
  } catch {
    return undefined;
  }
}
