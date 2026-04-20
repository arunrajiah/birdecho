import { apiFetch } from '../lib/apiClient';
import type { Station } from '../types/birdweather';

export async function fetchStation(stationId: string): Promise<Station> {
  const data = await apiFetch<{ station: Station }>(`/stations/${stationId}`);
  return data.station;
}
