import { apiFetch } from '../lib/apiClient';
import type { Station } from '../types/birdweather';

/**
 * BirdWeather returns the station object DIRECTLY (not wrapped in { station }):
 *   { id, name, coords: { lat, lon }, ... }
 * It has no top-level latitude/longitude and no timezone field.
 */
interface BwStationResponse {
  id?: number;
  name?: string;
  timezone?: string;
  coords?: { lat?: number; lon?: number };
  latitude?: number;
  longitude?: number;
}

export async function fetchStation(stationId: string, token?: string): Promise<Station> {
  const data = await apiFetch<BwStationResponse>(`/stations/${stationId}`, undefined, token);
  if (!data || data.id === undefined || data.id === null) {
    throw new Error('BirdWeather returned an unexpected response for this station.');
  }
  return {
    id: String(data.id),
    name: data.name ?? `Station ${stationId}`,
    latitude: data.coords?.lat ?? data.latitude ?? 0,
    longitude: data.coords?.lon ?? data.longitude ?? 0,
    // BirdWeather doesn't expose a timezone here; detection timestamps carry an
    // offset, so an empty value (device-local fallback in formatDate) is fine.
    timezone: data.timezone ?? '',
  };
}
