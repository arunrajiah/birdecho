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

// ─── This phone's location (GPS, with the approximate area as a fallback) ─────────────

/** What a one-shot GPS lookup gave: a fix, or why there is none ('unsupported' = build without GPS, e.g. F-Droid). */
export type PhoneFix =
  | { kind: 'gps'; latitude: number; longitude: number; accuracy?: number | null }
  | { kind: 'failed'; reason: 'denied' | 'off' | 'timeout' | 'unavailable' | 'unsupported' };

/** The phone's approximate area from Wildlife Network (IP based, whole degrees), or null when it was not found. */
export type PhoneArea = { lat: number; lon: number } | null;

export type PhoneLocation =
  | { ok: true; lat: string; lon: string; source: 'gps' | 'area'; note: string }
  | { ok: false; error: string };

const WHY_NO_GPS: Record<Extract<PhoneFix, { kind: 'failed' }>['reason'], string> = {
  denied: 'BirdEcho is not allowed to use this phone’s location (you can allow it in Settings)',
  off: 'Location is turned off on this phone',
  timeout: 'The phone could not get a GPS position in time',
  unavailable: 'The phone could not get a GPS position',
  unsupported: 'This version of BirdEcho does not read GPS',
};

const SHARED = 'Only a position rounded to about 1 km is sent to the Base and shared.';

function inRange(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/**
 * What to put in the latitude and longitude fields: the GPS fix rounded to 2 decimals (about 1 km, what the Base is
 * sent), else the approximate area with the reason GPS was not used, else an error asking to type them.
 */
export function phoneLocationResult(fix: PhoneFix, area: PhoneArea): PhoneLocation {
  if (fix.kind === 'gps' && inRange(fix.latitude, fix.longitude)) {
    const acc = fix.accuracy != null && Number.isFinite(fix.accuracy) && fix.accuracy > 0 ? fix.accuracy : null;
    const within = acc == null ? '' : acc < 1000 ? ` (within about ${Math.max(10, Math.round(acc / 10) * 10)} m)` : ` (within about ${Math.round(acc / 1000)} km)`;
    return {
      ok: true,
      lat: String(roundCoord(fix.latitude)),
      lon: String(roundCoord(fix.longitude)),
      source: 'gps',
      note: `From this phone’s location${within}. Adjust it if the Base stands somewhere else. ${SHARED}`,
    };
  }
  const why = fix.kind === 'failed' ? WHY_NO_GPS[fix.reason] : 'The phone gave a position that is not valid';
  if (area && inRange(area.lat, area.lon)) {
    return {
      ok: true,
      lat: String(area.lat),
      lon: String(area.lon),
      source: 'area',
      note: `${why}, so this is the phone’s approximate area (about 100 km). Adjust it to where the Base stands. ${SHARED}`,
    };
  }
  return { ok: false, error: `${why}. Enter the latitude and longitude instead.` };
}
