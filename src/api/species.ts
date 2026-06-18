import { apiFetch } from '../lib/apiClient';
import type { Species } from '../types/birdweather';

/**
 * BirdWeather station species shape:
 *   { id, commonName, scientificName, imageUrl, thumbnailUrl,
 *     detections: { total, ... } }
 * The endpoint returns { success, species: [...] }. Per-station detection count
 * lives at species.detections.total.
 */
interface BwSpecies {
  id: number;
  commonName: string;
  scientificName: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  detections?: { total?: number };
}

function mapBwSpecies(s: BwSpecies): Species {
  return {
    id: String(s.id),
    commonName: s.commonName,
    scientificName: s.scientificName,
    imageUrl: s.thumbnailUrl ?? s.imageUrl,
    count: s.detections?.total ?? 0,
  };
}

export async function fetchTopSpecies(stationId: string, limit: number): Promise<Species[]> {
  const data = await apiFetch<{ species?: BwSpecies[] }>(
    `/stations/${stationId}/species?limit=${limit}`,
  );
  return (data.species ?? []).map(mapBwSpecies).sort((a, b) => b.count - a.count);
}

export async function fetchSpecies(stationId: string, id: string): Promise<Species> {
  // The station species list carries the per-station count and images; the
  // global /species/{id} endpoint does not, so resolve from the station list.
  const data = await apiFetch<{ species?: BwSpecies[] }>(`/stations/${stationId}/species`);
  const match = (data.species ?? []).find(
    (s) => String(s.id) === id || s.scientificName === id,
  );
  if (!match) throw new Error(`Species not found: ${id}`);
  return mapBwSpecies(match);
}
