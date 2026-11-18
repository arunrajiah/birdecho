/**
 * Finding a Wildlife Network Base on the home network: turn mDNS services (`_wlnw-base._tcp`, which points at
 * wnbase's port) and known host names into addresses, then keep only those whose /api/info says
 * model "wildnetwork-base". Pure (the fetch is passed in), so it runs under the Node test runner.
 */
import type { BaseInfo } from './baseApi';

/** DNS-SD service type without the leading underscore and protocol, as the discovery module takes it. */
export const BASE_SERVICE = 'wlnw-base';
/** Host name prefixes a Base uses: wnbase sets wildnetwork-base-<last 4 of hardware id>; wlnw-base- is the short form. */
export const BASE_HOST_PREFIXES = ['wlnw-base-', 'wildnetwork-base-'];

/** What the discovery module reports for a service (a subset of its Service type). */
export interface FoundService {
  name?: string;
  hostName?: string | null;
  addresses?: string[];
  port?: number;
}

export interface FoundBase {
  url: string;
  info: BaseInfo;
}

function withPort(host: string, port: number | undefined): string {
  return port && port !== 80 ? `http://${host}:${port}` : `http://${host}`;
}

/**
 * Addresses to try for one mDNS service, best first: IPv4 addresses (always reachable from the app), then the
 * .local host name. IPv6 is left out: link-local addresses need a zone id that fetch cannot take.
 */
export function serviceUrls(service: FoundService): string[] {
  const urls: string[] = [];
  for (const a of service.addresses ?? []) {
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(a) && !a.startsWith('127.') && !a.startsWith('169.254.')) {
      urls.push(withPort(a, service.port));
    }
  }
  const host = service.hostName?.trim().replace(/\.$/, '').toLowerCase();
  if (host && /^[a-z0-9.-]+$/.test(host)) urls.push(withPort(host, service.port));
  return [...new Set(urls)];
}

/** The 4 characters after "Wildlife Network-" in a hotspot name, or what the user typed, lowercased. */
export function suffixFrom(input: string | null | undefined): string | null {
  const t = (input ?? '').trim();
  const tail = t.includes('-') ? t.slice(t.lastIndexOf('-') + 1) : t;
  return /^[0-9A-Za-z]{4}$/.test(tail) ? tail.toLowerCase() : null;
}

/** .local names to try for Bases this phone already knows of (their hotspot names) or label characters typed. */
export function nameUrls(suffixes: (string | null | undefined)[]): string[] {
  const ok = [...new Set(suffixes.map(suffixFrom).filter((s): s is string => !!s))];
  return ok.flatMap((s) => BASE_HOST_PREFIXES.map((p) => `http://${p}${s}.local`));
}

/** True when /api/info is from a Wildlife Network Base. */
export function isBaseInfo(info: unknown): info is BaseInfo {
  const i = info as Partial<BaseInfo> | null;
  return !!i && i.model === 'wildnetwork-base' && typeof i.hardwareId === 'string' && i.hardwareId.length > 0;
}

/**
 * Ask /api/info at every address (in parallel) and keep the Bases, one entry per hardware id, at the first
 * address in the list that answered (so service addresses beat guessed names).
 */
export async function verifyBases(
  urls: string[],
  fetchInfo: (url: string) => Promise<unknown>,
): Promise<FoundBase[]> {
  const unique = [...new Set(urls)];
  const answers = await Promise.all(unique.map((u) => fetchInfo(u).catch(() => null)));
  const byHw = new Map<string, FoundBase>();
  unique.forEach((url, i) => {
    const info = answers[i];
    if (isBaseInfo(info) && !byHw.has(info.hardwareId)) byHw.set(info.hardwareId, { url, info });
  });
  return [...byHw.values()];
}


/** Waiting for the Base on its hotspot: ask every 3 s (each try up to 2.5 s) for up to 5 minutes. */
export const HOTSPOT_POLL = { intervalMs: 3000, requestMs: 2500, timeoutMs: 5 * 60_000 };

/**
 * Wait for something to succeed: call `attempt` every `intervalMs` until it returns a value or `timeoutMs`
 * has passed (then null). Used to notice when the phone has joined the Base's hotspot.
 */
export async function pollUntil<T>(
  attempt: () => Promise<T | null>,
  opts: { intervalMs: number; timeoutMs: number; cancelled?: () => boolean; now?: () => number; sleep?: (ms: number) => Promise<void> },
): Promise<T | null> {
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const end = now() + opts.timeoutMs;
  while (!opts.cancelled?.()) {
    const v = await attempt().catch(() => null);
    if (v != null) return v;
    if (now() + opts.intervalMs > end) return null;
    await sleep(opts.intervalMs);
  }
  return null;
}
