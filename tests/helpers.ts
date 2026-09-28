import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function fixture(name: string): string {
  return readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8');
}

type Route = { match: RegExp | string; body: string; status?: number; contentType?: string };

/**
 * Replace global fetch with a router over recorded station responses.
 * Returns the list of requested URLs so tests can assert on what was asked.
 * The first matching route wins; an unmatched request fails the test loudly.
 */
export function mockFetch(routes: Route[]): string[] {
  const requested: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const key = init?.body ? `${url} ${String(init.body)}` : url;
    requested.push(key);
    const route = routes.find((r) =>
      typeof r.match === 'string' ? key.includes(r.match) : r.match.test(key),
    );
    if (!route) throw new Error(`unexpected request: ${key}`);
    const contentType =
      route.contentType ??
      (route.body.trimStart().startsWith('<') ? 'text/html; charset=UTF-8' : 'application/json');
    return new Response(route.body, {
      status: route.status ?? 200,
      headers: { 'content-type': contentType },
    });
  }) as typeof fetch;
  return requested;
}
