import { getToken } from './secureStorage';

const BASE_URL = 'https://app.birdweather.com/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  tokenOverride?: string,
): Promise<T> {
  const token = tokenOverride ?? (await getToken());
  const url = new URL(`${BASE_URL}${path}`);
  if (token) {
    url.searchParams.set('token', token);
  }

  const response = await fetch(url.toString(), init);

  if (!response.ok) {
    const body = await response.text();
    throw new ApiError(response.status, `API error ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}
