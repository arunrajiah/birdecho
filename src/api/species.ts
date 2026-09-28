import { apiFetch } from '../lib/apiClient';
import type { Species } from '../types/birdweather';

/**
 * BirdWeather station species shape:
 *   { id, commonName, scientificName, imageUrl, thumbnailUrl,
 *     detections: { total, ... } }
 * The endpoint returns { success, species: [...] }. Per-station detection count
 * lives at species.detections.total (absent on the global /species/{id}).
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

const PAGE_SIZE = 100; // server maximum
const MAX_PAGES = 10;

/**
 * Station species, most detected first. The endpoint defaults to `period=day`
 * (only species heard today), so ask for `period=all`; it returns at most 100
 * per page.
 */
async function fetchStationSpecies(
  stationId: string,
  limit: number,
  until?: (s: BwSpecies) => boolean,
): Promise<BwSpecies[]> {
  const all: BwSpecies[] = [];
  for (let page = 1; page <= MAX_PAGES && all.length < limit; page++) {
    const data = await apiFetch<{ species?: BwSpecies[] }>(
      `/stations/${stationId}/species?period=all&limit=${PAGE_SIZE}&page=${page}`,
    );
    const rows = data.species ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE || (until && rows.some(until))) break;
  }
  return all;
}

export async function fetchTopSpecies(stationId: string, limit: number): Promise<Species[]> {
  const rows = await fetchStationSpecies(stationId, limit);
  return rows
    .map(mapBwSpecies)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function fetchSpecies(stationId: string, id: string): Promise<Species> {
  // The station species list carries the per-station count; the global
  // /species/{id} endpoint does not, so it is only the fallback.
  const isMatch = (s: BwSpecies) => String(s.id) === id || s.scientificName === id;
  let match: BwSpecies | undefined;
  try {
    match = (await fetchStationSpecies(stationId, PAGE_SIZE * MAX_PAGES, isMatch)).find(isMatch);
  } catch (e) {
    if (!/^\d+$/.test(id)) throw e;
  }
  if (!match && /^\d+$/.test(id)) {
    const data = await apiFetch<{ species?: BwSpecies }>(`/species/${id}`);
    match = data.species;
  }
  if (!match) throw new Error(`Species not found: ${id}`);
  return mapBwSpecies(match);
}
