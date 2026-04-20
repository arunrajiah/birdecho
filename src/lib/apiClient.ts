import { getToken } from './secureStorage';

const BASE_URL = 'https://app.birdweather.com/api/v1';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken();
  const url = new URL(`${BASE_URL}${path}`);
  if (token) {
    url.searchParams.set('token', token);
  }

  const response = await fetch(url.toString(), init);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}
