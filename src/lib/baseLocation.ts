/**
 * Changing the location of a Wildlife Network Base that was moved: checking what was typed, picking the setup
 * code and building the POST /api/config request (wildnetwork-base README, "POST /api/config"). Pure, so it runs
 * under the Node test runner.
 */
import { BaseError, normalizeSetupCode, roundCoord, type BaseConfig } from './baseApi';

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** "13,08" and " 13.08 " both read as 13.08. Empty or not a number is null. */
function num(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!t || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Latitude -90..90 and longitude -180..180, rounded to 2 decimals (about 1 km) like the Base's first setup. */
export function parseLocation(lat: string, lon: string): Parsed<{ latitude: number; longitude: number }> {
  const la = num(lat);
  const lo = num(lon);
  if (la == null || lo == null) return { ok: false, error: 'Enter the latitude and longitude as numbers, for example 13.08 and 80.27.' };
  if (la < -90 || la > 90) return { ok: false, error: 'Latitude must be between -90 and 90.' };
  if (lo < -180 || lo > 180) return { ok: false, error: 'Longitude must be between -180 and 180.' };
  return { ok: true, value: { latitude: roundCoord(la), longitude: roundCoord(lo) } };
}

/** The code typed in when there is one, else the code saved when this phone set the Base up. */
export function pickSetupCode(saved: string | null | undefined, typed: string): Parsed<string> {
  if (typed.trim()) {
    const code = normalizeSetupCode(typed);
    return code ? { ok: true, value: code } : { ok: false, error: 'The setup code is 8 letters and digits, printed on the label.' };
  }
  const code = saved ? normalizeSetupCode(saved) : null;
  return code ? { ok: true, value: code } : { ok: false, error: 'Enter the setup code from the label on the Base.' };
}

export interface LocationRequest {
  code: string;
  config: Pick<BaseConfig, 'latitude' | 'longitude'>;
}

/** The setup code and body for POST /api/config: only latitude and longitude, so nothing else on the Base changes. */
export function buildLocationRequest(lat: string, lon: string, savedCode: string | null | undefined, typedCode: string): Parsed<LocationRequest> {
  const loc = parseLocation(lat, lon);
  if (!loc.ok) return loc;
  const code = pickSetupCode(savedCode, typedCode);
  if (!code.ok) return code;
  return { ok: true, value: { code: code.value, config: { latitude: loc.value.latitude, longitude: loc.value.longitude } } };
}

/** Shown before saving. */
export const LOCATION_CHANGE_NOTE =
  'Detections from before keep their old place. New detections use the new location. The map updates after the next detection.';

/** What to tell the user when saving failed, and whether to ask for the setup code. */
export function locationErrorMessage(e: unknown): { message: string; askForCode: boolean } {
  if (e instanceof BaseError) {
    if (e.status === 403) return { message: 'The setup code is not right. Check the label on the Base, or wildnetwork-setup.txt on its SD card.', askForCode: true };
    if (e.status === 0) {
      return { message: 'Could not reach the Base. Check that the phone is on the Base’s Wi-Fi or the same Wi-Fi as the Base, then try again.', askForCode: false };
    }
    return { message: e.message, askForCode: false };
  }
  return { message: e instanceof Error ? e.message : 'Something went wrong.', askForCode: false };
}

/** "13.08, 80.27", or "not set" when the Base has no location yet. */
export function formatLocation(lat: number | null | undefined, lon: number | null | undefined): string {
  return lat == null || lon == null ? 'not set' : `${lat}, ${lon}`;
}
