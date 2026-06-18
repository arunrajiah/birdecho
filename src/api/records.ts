import { apiFetch } from '../lib/apiClient';
import type { Detection, RecordsPage } from '../types/birdweather';

/**
 * BirdWeather REST API (https://app.birdweather.com/api/v1) detection shapes.
 *
 * A detection nests its species and soundscape:
 *   { id, timestamp, confidence (0–1), species:{ id, commonName, scientificName,
 *     imageUrl, thumbnailUrl }, soundscape:{ url } }
 *
 * The list endpoint returns { success, detections: [...] } (NOT a paged wrapper).
 * Pagination is by `?cursor=<id>` — passing a detection id returns rows older
 * than it. Per-species filtering is `?species=<id>`; today is `?period=day`.
 */
export interface BwDetection {
  id: number;
  timestamp: string;
  confidence: number;
  species?: {
    id?: number;
    commonName?: string;
    scientificName?: string;
    imageUrl?: string;
    thumbnailUrl?: string;
  };
  soundscape?: { url?: string };
}

const PAGE_SIZE = 50;

export function mapBwDetection(d: BwDetection): Detection {
  const sp = d.species ?? {};
  return {
    id: String(d.id),
    speciesId: String(sp.id ?? sp.scientificName ?? ''),
    commonName: sp.commonName ?? 'Unknown',
    scientificName: sp.scientificName ?? '',
    timestamp: d.timestamp,
    confidence: typeof d.confidence === 'number' ? d.confidence : 0,
    soundscapeUrl: d.soundscape?.url,
    imageUrl: sp.thumbnailUrl ?? sp.imageUrl,
  };
}

export async function fetchRecentRecords(
  stationId: string,
  cursor?: string,
): Promise<RecordsPage> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) params.set('cursor', cursor);
  const data = await apiFetch<{ detections?: BwDetection[] }>(
    `/stations/${stationId}/detections?${params}`,
  );
  const records = (data.detections ?? []).map(mapBwDetection);
  // A full page implies there may be more; cursor is the last (oldest) id.
  const nextCursor =
    records.length === PAGE_SIZE ? records[records.length - 1]!.id : undefined;
  return { records, cursor: nextCursor };
}

export async function fetchRecord(id: string): Promise<Detection> {
  // The global detection endpoint may wrap the row or return it directly.
  const data = await apiFetch<{ detection?: BwDetection } & Partial<BwDetection>>(
    `/detections/${id}`,
  );
  const d = (data.detection ?? data) as BwDetection;
  return mapBwDetection(d);
}

export async function fetchRecordsForSpecies(
  stationId: string,
  speciesId: string,
  limit = 10,
): Promise<Detection[]> {
  const params = new URLSearchParams({ limit: String(limit), species: speciesId });
  const data = await apiFetch<{ detections?: BwDetection[] }>(
    `/stations/${stationId}/detections?${params}`,
  );
  return (data.detections ?? []).map(mapBwDetection);
}
