import { apiFetch } from '../lib/apiClient';
import type { Station } from '../types/birdweather';

export async function fetchStation(stationId: string, token?: string): Promise<Station> {
  const data = await apiFetch<{ station: Station }>(`/stations/${stationId}`, undefined, token);
  return data.station;
}
