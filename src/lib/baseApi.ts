/**
 * Wildlife Network Base: setup-code and Wi-Fi name helpers and the Base's local API (no native code, so it
 * runs under the Node test runner). Contract: wildnetwork-base/base/wnbase.py, wildnetwork/docs/BASE-FIELD-APP.md.
 */

/** The Base's address on its own hotspot. */
export const BASE_HOTSPOT_URL = 'http://10.42.0.1';
export const BASE_SSID_PREFIX = 'Wildlife Network-';

/** Setup codes: 8 characters from this alphabet (no I, L, O, 0 or 1). */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** "abcd efgh", "ABCD-EFGH" -> "ABCDEFGH", or null when it cannot be a setup code. */
export function normalizeSetupCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  return code.length === 8 && [...code].every((c) => CODE_ALPHABET.includes(c)) ? code : null;
}

/** The 4 characters after "Wildlife Network-" (the label shows them), or a full SSID pasted in. */
export function ssidFor(input: string): string | null {
  const t = input.trim();
  const tail = t.toUpperCase().startsWith(BASE_SSID_PREFIX.toUpperCase()) ? t.slice(BASE_SSID_PREFIX.length) : t;
  return /^[0-9A-Za-z]{4}$/.test(tail) ? BASE_SSID_PREFIX + tail.toUpperCase() : null;
}

export function hotspotPassword(code: string): string {
  return `wn-${code}`;
}


// ─── Local API ────────────────────────────────────────────────────────────────

export interface BaseInfo {
  hardwareId: string;
  model: string;
  hostname: string;
  software?: Record<string, string | null>;
  configured: boolean;
  deviceId: string | null;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  registration?: string;
}

export interface BaseConfig {
  name?: string;
  latitude?: number;
  longitude?: number;
  roundCoords?: number;
  apiKey?: string;
  deviceId?: string;
  endpoint?: string;
  apn?: string;
  wifi?: { ssid: string; psk: string };
}

export class BaseError extends Error {}

async function call<T>(base: string, path: string, init: RequestInit = {}, timeoutMs = 10_000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}${path}`, { ...init, signal: ctrl.signal });
    const body = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) {
      if (res.status === 403) throw new BaseError('The setup code is not right. Check the label on the Base.');
      if (res.status === 429) throw new BaseError('Too many wrong setup codes. Wait 10 minutes, then try again.');
      throw new BaseError(body.error ?? `The Base answered with an error (${res.status}).`);
    }
    return body;
  } catch (e) {
    if (e instanceof BaseError) throw e;
    throw new BaseError('Could not reach the Base. Stay close to it and check that you are on its Wi-Fi.');
  } finally {
    clearTimeout(timer);
  }
}

export function getBaseInfo(base: string): Promise<BaseInfo> {
  return call<BaseInfo>(base, '/api/info');
}

/** `warnings` lists settings the Base could not apply (for example Wi-Fi or APN); `notes` are informational. */
export function configureBase(base: string, code: string, config: BaseConfig): Promise<{ ok: boolean; configured: boolean; warnings?: string[]; notes?: string[] }> {
  return call(base, '/api/config', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-setup-code': code },
    body: JSON.stringify(config),
  });
}

export interface BaseStatus {
  battery?: { percent?: number; charging?: boolean } | null;
  storage?: { freeMb?: number; totalMb?: number } | null;
  temperatureC?: number | null;
  uptimeSeconds?: number | null;
  queue?: { pending?: number } | null;
  lastUpload?: string | null;
  network?: Record<string, unknown> | null;
  error?: string;
}

export function getBaseStatus(base: string): Promise<BaseStatus> {
  return call<BaseStatus>(base, '/api/status');
}

/** Round to 2 decimals (about 1 km), the Base's default and what Wildlife Network shows. */
export function roundCoord(v: number): number {
  return Math.round(v * 100) / 100;
}
