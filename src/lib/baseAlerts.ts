import { WILDNETWORK_BASE } from './wildnetwork';

/**
 * Health email pauses for a Base (Wildlife Network emails the owner when a Base stops reporting, loses its microphone
 * or runs hot), and the links to the Base's station page. Pure apart from sendAlertPause, which takes a fetch.
 */

export type PauseChoice = 'day' | 'week' | 'month' | 'forever' | 'resume';

/** "Until I turn them back on": the server takes any time up to about 100 years ahead. */
export const PAUSE_FOREVER = '2099-01-01T00:00:00Z';

const DAY_MS = 24 * 60 * 60 * 1000;

export const PAUSE_CHOICES: { choice: PauseChoice; label: string }[] = [
  { choice: 'day', label: '1 day' },
  { choice: 'week', label: '1 week' },
  { choice: 'month', label: '1 month' },
  { choice: 'forever', label: 'Until I turn them back on' },
];

/** The alertsPausedUntil value for a choice: an ISO time, or null to turn the emails back on. */
export function pauseUntil(choice: PauseChoice, now: Date = new Date()): string | null {
  switch (choice) {
    case 'day':
      return new Date(now.getTime() + DAY_MS).toISOString();
    case 'week':
      return new Date(now.getTime() + 7 * DAY_MS).toISOString();
    case 'month':
      return new Date(now.getTime() + 30 * DAY_MS).toISOString();
    case 'forever':
      return PAUSE_FOREVER;
    case 'resume':
      return null;
  }
}

/** POST <site>/api/v1/devices/<deviceId>/settings with the Base's own key. */
export function pauseRequest(deviceId: string, apiKey: string, until: string | null): { url: string; init: RequestInit } {
  return {
    url: `${WILDNETWORK_BASE}/api/v1/devices/${encodeURIComponent(deviceId)}/settings`,
    init: {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ alertsPausedUntil: until }),
    },
  };
}

/** What to tell the owner when the request failed: status null means it never reached Wildlife Network. */
export function pauseError(status: number | null): string {
  if (status == null) return 'This needs internet. Try again when the phone is online (Wi-Fi or mobile data).';
  if (status === 401 || status === 403) return 'Wildlife Network did not accept the Base’s key saved on this phone.';
  if (status === 400 || status === 404 || status === 405) return 'Not available yet, try again later.';
  return 'Wildlife Network could not save this right now. Try again later.';
}

/** True when the pause is far enough ahead to mean "until I turn them back on" (2099). */
export function isOpenEnded(until: string): boolean {
  return new Date(until).getUTCFullYear() >= 2090;
}

/** Whether emails are paused now, from the time last sent or read back. Null, missing or past means they are on. */
export function isPaused(until: string | null | undefined, now: Date = new Date()): boolean {
  if (!until) return false;
  const t = Date.parse(until);
  return Number.isFinite(t) && t > now.getTime();
}

/** One line for the Base page. */
export function pauseLabel(until: string | null | undefined, now: Date = new Date()): string {
  if (!isPaused(until, now)) return 'Alerts are on. Wildlife Network emails you if this Base stops reporting, loses its microphone or runs hot.';
  if (isOpenEnded(until!)) return 'Alerts are paused until you turn them back on.';
  const when = new Date(until!).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  return `Alerts are paused until ${when}.`;
}

export type PauseResult = { ok: true; until: string | null } | { ok: false; status: number | null; error: string };

/** Sends the pause (or resume). On success returns the time Wildlife Network saved (null = alerts on). */
export async function sendAlertPause(
  deviceId: string,
  apiKey: string,
  until: string | null,
  f: typeof fetch = fetch,
): Promise<PauseResult> {
  const { url, init } = pauseRequest(deviceId, apiKey, until);
  let res: Response;
  try {
    res = await f(url, init);
  } catch {
    return { ok: false, status: null, error: pauseError(null) };
  }
  if (!res.ok) return { ok: false, status: res.status, error: pauseError(res.status) };
  const j = (await res.json().catch(() => null)) as { alertsPausedUntil?: unknown } | null;
  // An older server answers 200 without the field: it ignored the pause.
  if (!j || !('alertsPausedUntil' in j)) return { ok: false, status: 404, error: pauseError(404) };
  const saved = typeof j.alertsPausedUntil === 'string' ? j.alertsPausedUntil : null;
  return { ok: true, until: saved };
}

/** Current settings read back with the Base's key (GET, same path), or null when they cannot be read. */
export async function fetchDeviceSettings(
  deviceId: string,
  apiKey: string,
  f: typeof fetch = fetch,
): Promise<{ test: boolean | null; alertsPausedUntil: string | null | undefined } | null> {
  try {
    const { url } = pauseRequest(deviceId, apiKey, null);
    const res = await f(url, { headers: { authorization: `Bearer ${apiKey}`, accept: 'application/json' } });
    if (!res.ok) return null;
    const j = (await res.json()) as { test?: unknown; alertsPausedUntil?: unknown };
    return {
      test: typeof j.test === 'boolean' ? j.test : null,
      // undefined: this server does not know about pauses yet, so keep what the phone last sent.
      alertsPausedUntil: !('alertsPausedUntil' in j) ? undefined : typeof j.alertsPausedUntil === 'string' ? j.alertsPausedUntil : null,
    };
  } catch {
    return null;
  }
}

/**
 * Slug of a station page for a deployment id "<source>:<id>": source, "~", then the id part percent-encoded
 * (same rule as stationSlug in Wildlife Network's src/lib/stationIds.ts). Null when the id has no source.
 */
export function stationSlug(deploymentId: string): string | null {
  const i = deploymentId.indexOf(':');
  if (i <= 0 || i === deploymentId.length - 1) return null;
  return `${deploymentId.slice(0, i)}~${encodeURIComponent(deploymentId.slice(i + 1))}`;
}

export function stationPageUrl(deploymentId: string): string | null {
  const slug = stationSlug(deploymentId);
  return slug ? `${WILDNETWORK_BASE}/stations/${slug}` : null;
}

export const MY_STATIONS_URL = `${WILDNETWORK_BASE}/stations/mine`;
