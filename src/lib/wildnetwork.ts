/**
 * WildNetwork (https://wildnetwork.arunrajiah.com) contribution helpers.
 *
 * BirdEcho does not relay detections itself: it registers a device key and hands
 * the user the wdx-agent install command with that key filled in. The agent on the
 * Pi then sends the full detection stream (see wildnetwork /api/v1/register).
 */
import type { ConnectionType } from '../types/station';

export const WILDNETWORK_BASE = 'https://wildnetwork.arunrajiah.com';
export const WILDNETWORK_CONTRIBUTE_URL = `${WILDNETWORK_BASE}/contribute`;

/** WildNetwork source systems for the station types the agent supports. */
const SOURCE: Partial<Record<ConnectionType, 'birdnet-pi' | 'birdnet-go'>> = {
  birdnetpi: 'birdnet-pi',
  birdnetgo: 'birdnet-go',
};

export function wildNetworkSource(type: ConnectionType) {
  return SOURCE[type] ?? null;
}

export async function registerWithWildNetwork(name: string, type: ConnectionType): Promise<string> {
  const source = wildNetworkSource(type);
  if (!source) throw new Error('This station type cannot send to WildNetwork.');
  const res = await fetch(`${WILDNETWORK_BASE}/api/v1/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: name.trim().length >= 3 ? name.trim().slice(0, 80) : 'BirdEcho station', source }),
  });
  const body = (await res.json().catch(() => ({}))) as { apiKey?: string; error?: string };
  if (res.status === 429) throw new Error('Too many stations registered from this network today. Try again tomorrow.');
  if (!res.ok || !body.apiKey) throw new Error(body.error ?? `Registration failed (HTTP ${res.status}).`);
  return body.apiKey;
}

/**
 * Install command for the Pi. Only WDX_KEY is set: the installer detects the
 * source and database path itself (setting WDX_SOURCE would skip path detection).
 */
export function installCommand(apiKey: string): string {
  return `curl -fsSL ${WILDNETWORK_BASE}/agent/install.sh | WDX_KEY=${apiKey} bash`;
}

// ─── Read side: WildNetwork context for the station's area ───────────────────

/** Seasonal timing for one species in one 5-degree cell (WildNetwork /api/v1/arrivals). */
export interface CellArrival {
  scientificName: string;
  vernacularName: string | null;
  cellLat: number;
  cellLon: number;
  region: string;
  arrivalWeek: string | null;
  peakWeek: string | null;
  departureWeek: string | null;
  detections: number;
  /** Share of resamples that still find this season (0 to 1); under 0.5 is weak. */
  arrivalSupport?: number | null;
}

/**
 * WildNetwork's threshold for a believable arrival: below it the "season" is
 * usually a repeated misdetection (for example a Eurasian Curlew in Boston).
 */
export const MIN_ARRIVAL_SUPPORT = 0.5;

/** True unless WildNetwork marks this arrival as weak. Rows without the field are kept. */
export function isSolidArrival(a: Pick<CellArrival, 'arrivalSupport'>): boolean {
  return a.arrivalSupport == null || a.arrivalSupport >= MIN_ARRIVAL_SUPPORT;
}

/** A species whose range centre moved within one continent (WildNetwork /api/v1/insights). */
export interface Drift {
  scientificName: string;
  vernacularName: string | null;
  region: string;
  driftDeg: number;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${WILDNETWORK_BASE}${path}`);
  if (!res.ok) throw new Error(`WildNetwork HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Every species with seasonal timing in the 5-degree cell containing the point. */
export async function fetchCellArrivals(lat: number, lon: number): Promise<CellArrival[]> {
  const j = await getJson<{ arrivals: CellArrival[] }>(`/api/v1/arrivals?lat=${lat}&lon=${lon}`);
  return j.arrivals;
}

/** Bird species moving north or south within a region (continent). */
export async function fetchRegionDrift(region: string): Promise<Drift[]> {
  const j = await getJson<{ drift: Drift[] }>('/api/v1/insights?group=avian');
  return j.drift.filter((d) => d.region === region);
}

/** Same continent split as WildNetwork's REGION (src/lib/methods.ts), applied to the cell corner. */
export function regionFor(lat: number, lon: number): string {
  const cLat = Math.floor(lat / 5) * 5;
  const cLon = Math.floor(lon / 5) * 5;
  if (cLon < -30) return cLat >= 10 ? 'North America' : 'South America';
  if (cLon < 60) return cLat >= 35 ? 'Europe' : 'Africa';
  if (cLon >= 110 && cLat < -10) return 'Oceania';
  return 'Asia';
}

export function speciesUrl(scientificName: string): string {
  return `${WILDNETWORK_BASE}/species/${scientificName.toLowerCase().replace(/\s+/g, '-')}`;
}

/** "2026-09-21" (a Monday) -> "21 Sep". Weeks are ISO dates from WildNetwork. */
export function formatWeek(week: string | null): string | null {
  if (!week) return null;
  const d = new Date(`${week}T00:00:00Z`);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
