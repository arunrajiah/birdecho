import { apiFetch } from '../lib/apiClient';
import type { Species } from '../types/birdweather';

export async function fetchTopSpecies(stationId: string, limit: number): Promise<Species[]> {
  const data = await apiFetch<{ species: Species[] }>(
    `/stations/${stationId}/species?limit=${limit}`,
  );
  return data.species;
}

export async function fetchSpecies(id: string): Promise<Species> {
  const data = await apiFetch<{ species: Species }>(`/species/${id}`);
  return data.species;
}
