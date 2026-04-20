import { apiFetch } from '../lib/apiClient';
import type { Detection, RecordsPage } from '../types/birdweather';

export async function fetchRecentRecords(
  stationId: string,
  cursor?: string,
): Promise<RecordsPage> {
  const params = new URLSearchParams({ limit: '50' });
  if (cursor) params.set('cursor', cursor);
  return apiFetch<RecordsPage>(`/stations/${stationId}/detections?${params}`);
}

export async function fetchRecord(id: string): Promise<Detection> {
  const data = await apiFetch<{ detection: Detection }>(`/detections/${id}`);
  return data.detection;
}

export async function fetchRecordsForSpecies(
  stationId: string,
  speciesId: string,
  limit = 10,
): Promise<Detection[]> {
  const params = new URLSearchParams({ limit: String(limit), speciesId });
  const data = await apiFetch<RecordsPage>(`/stations/${stationId}/detections?${params}`);
  return data.records;
}
