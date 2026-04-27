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

  // H-1: Send token as Authorization header, never as a URL query param.
  // URL query params are captured in server logs, proxy logs, and Sentry breadcrumbs.
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> ?? {}),
  };
  if (token) {
    headers['X-Auth-Token'] = token;
  }

  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, { ...init, headers });

  if (!response.ok) {
    // L-3: Verify JSON before parsing; surface a clean message on unexpected content.
    const ct = response.headers.get('content-type') ?? '';

    // H-2: Cap the raw body at 200 chars so it doesn't pollute Sentry events
    // with potentially sensitive server internals.
    const raw = await response.text();
    const snippet = raw.length > 200 ? raw.slice(0, 200) + '…' : raw;
    throw new ApiError(response.status, `API error ${response.status}${ct.includes('json') ? `: ${snippet}` : ''}`);
  }

  // L-3: Guard against captive portals or CDN HTML error pages.
  const ct = response.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    throw new ApiError(response.status, 'Unexpected response from BirdWeather — is the API reachable?');
  }

  return response.json() as Promise<T>;
}
