/**
 * Share a BirdNET-Go station's detections with Wildlife Network from this phone, with nothing to install on the
 * station. Whenever the app is opened (or comes back to the front) and the phone can reach the station on its
 * network, BirdEcho reads the detections made since the last one it sent from BirdNET-Go's /api/v2 and uploads them
 * with the station's own device key. BirdNET-Go keeps the detections, so nothing is queued on the phone: the
 * position only moves on after Wildlife Network accepted a batch, and a phone that was away just catches up.
 *
 * Events match what wdx-agent would send for the same station (source birdnet-go, confidence 0.7 and up, coordinates
 * rounded to 2 decimals, about 1 km). If the owner installs the agent later, the install command passes this
 * station's id and the time of the last shared detection (WDX_STATION_ID, WDX_START_AFTER), so nothing is sent twice.
 *
 * Pure apart from the functions that take a fetch or touch storage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WILDNETWORK_BASE } from './wildnetwork';

export const MIN_CONFIDENCE = 0.7;
/** The first share goes back this far; after that, only what is new. */
export const FIRST_SHARE_DAYS = 7;
/** At most this many detections are read in one run (a phone away for weeks catches up over several runs). */
export const MAX_PER_RUN = 20000;
/** A station is not asked again sooner than this. */
export const MIN_INTERVAL_MS = 10 * 60 * 1000;
const PAGE = 100;
const BATCH = 500;

/** The parts of a BirdNET-Go /api/v2/detections item that are used. */
export interface BngItem {
  id: number;
  timestamp?: string;
  date?: string;
  time?: string;
  scientificName: string;
  commonName?: string;
  confidence: number;
  latitude?: number;
  longitude?: number;
  verified?: string;
  /** BirdNET-Go marks species unlikely for the station's place; wdx-agent skips them too. */
  unlikely?: boolean;
}

export interface ShareState {
  on: boolean;
  /** Highest BirdNET-Go detection id sent (null before the first share). */
  lastId: number | null;
  /** Time of that detection (ISO), passed to the agent as WDX_START_AFTER. */
  lastTime: string | null;
  lastRun: string | null;
  /** Last time something was accepted by Wildlife Network. */
  lastSent: string | null;
  sent: number;
  /** Why the last run did not finish, in words for the owner; null when it did. */
  problem: string | null;
  /** Where the station stands (rounded), used when BirdNET-Go's detections carry no coordinates. */
  lat: number | null;
  lon: number | null;
}

export const EMPTY_STATE: ShareState = {
  on: false, lastId: null, lastTime: null, lastRun: null, lastSent: null, sent: 0, problem: null, lat: null, lon: null,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** ISO instant of a detection: the API's timestamp (with its zone); null when it has none. */
export function detectionTime(d: BngItem): string | null {
  const t = d.timestamp ? Date.parse(d.timestamp) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString().replace('.000Z', 'Z') : null;
}

export interface WdxOptions {
  /** Wildlife Network device id of this station: used as its deployment id and in every eventId. */
  stationId: string;
  stationName: string | null;
  appVersion: string;
  fallback: { lat: number; lon: number } | null;
}

/** One detection as a WDX event, or null when it is not sent (low confidence, marked wrong, no time or place). */
export function toWdx(d: BngItem, o: WdxOptions): Record<string, unknown> | null {
  if (!d.scientificName || typeof d.confidence !== 'number' || d.confidence < MIN_CONFIDENCE) return null;
  if (d.verified === 'false_positive' || d.unlikely) return null;
  const when = detectionTime(d);
  if (!when) return null;
  const has = typeof d.latitude === 'number' && typeof d.longitude === 'number' && (d.latitude !== 0 || d.longitude !== 0);
  const lat = has ? d.latitude! : o.fallback?.lat;
  const lon = has ? d.longitude! : o.fallback?.lon;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  const record = String(d.id);
  return {
    wdx: '0.1',
    eventId: `birdnet-go:${o.stationId}:${record}`,
    eventStart: when,
    deployment: {
      deploymentId: o.stationId,
      latitude: round2(lat),
      longitude: round2(lon),
      coordinateUncertaintyMeters: 1110,
      sensorType: 'acoustic-recorder',
      sensorModel: 'BirdNET-Go',
      ...(o.stationName ? { name: o.stationName } : {}),
    },
    review: { status: d.verified === 'correct' ? 'confirmed' : 'unreviewed' },
    detection: {
      scientificName: d.scientificName,
      ...(d.commonName ? { vernacularName: d.commonName } : {}),
      taxonRank: 'species',
      confidence: d.confidence,
      classifier: { name: 'BirdNET', version: 'unknown' },
    },
    source: { system: 'birdnet-go', systemVersion: `birdecho/${o.appVersion}`, sourceRecordId: record },
    license: 'https://creativecommons.org/licenses/by/4.0/',
  };
}

/**
 * Detections newer than lastId (or, on the first share, from the last FIRST_SHARE_DAYS), oldest first. Reads pages
 * newest first and stops at the first one it already sent, at the start of the window, or at MAX_PER_RUN.
 * MAX_PER_RUN (weeks of a busy station) only guards against a station that never stops paging; past it, the older
 * detections are left out.
 */
export async function readNew(
  fetchPage: (offset: number) => Promise<BngItem[]>,
  lastId: number | null,
  now: number = Date.now(),
): Promise<BngItem[]> {
  const since = now - FIRST_SHARE_DAYS * 86_400_000;
  const out: BngItem[] = [];
  for (let offset = 0; out.length < MAX_PER_RUN; offset += PAGE) {
    const page = await fetchPage(offset);
    if (!page.length) break;
    let done = false;
    for (const d of page) {
      if (lastId != null ? d.id <= lastId : (Date.parse(d.timestamp ?? '') || 0) < since) { done = true; break; }
      out.push(d);
    }
    if (done || page.length < PAGE) break;
  }
  // Newest-first pages can repeat an item when a detection arrives between two pages.
  const seen = new Set<number>();
  return out.filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true))).sort((a, b) => a.id - b.id);
}

export interface ShareTarget {
  hostUrl: string;
  apiKey: string;
  deviceId: string;
  stationName: string | null;
  appVersion: string;
}

export type ShareResult =
  | { ok: true; sent: number; read: number; lastId: number | null; lastTime: string | null }
  | { ok: false; problem: string; sent: number; lastId: number | null; lastTime: string | null };

/** Upload one station's new detections. Never throws. */
export async function shareOnce(t: ShareTarget, state: ShareState, f: typeof fetch = fetch, now = Date.now()): Promise<ShareResult> {
  const base = t.hostUrl.replace(/\/+$/, '');
  let items: BngItem[];
  try {
    items = await readNew(async (offset) => {
      const r = await f(`${base}/api/v2/detections?limit=${PAGE}&offset=${offset}&order=desc`, { headers: { accept: 'application/json' } });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { data?: BngItem[] };
      return Array.isArray(j.data) ? j.data : [];
    }, state.lastId, now);
  } catch {
    return { ok: false, problem: 'The station did not answer. BirdEcho sends when this phone is on the same Wi-Fi as the station.', sent: 0, lastId: state.lastId, lastTime: state.lastTime };
  }
  const fallback = state.lat != null && state.lon != null ? { lat: state.lat, lon: state.lon } : null;
  let lastId = state.lastId, lastTime = state.lastTime, sent = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH);
    const events = chunk.map((d) => toWdx(d, { stationId: t.deviceId, stationName: t.stationName, appVersion: t.appVersion, fallback })).filter(Boolean);
    if (!events.length && chunk.some((d) => d.confidence >= MIN_CONFIDENCE && d.verified !== 'false_positive' && !d.unlikely)) {
      return { ok: false, problem: 'The station does not say where it is. Set the station location below.', sent, lastId, lastTime };
    }
    if (events.length) {
      let res: Response;
      try {
        res = await f(`${WILDNETWORK_BASE}/api/v1/events`, {
          method: 'POST',
          headers: { authorization: `Bearer ${t.apiKey}`, 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(events),
        });
      } catch {
        return { ok: false, problem: 'This needs internet as well. BirdEcho tries again next time.', sent, lastId, lastTime };
      }
      if (res.status === 401 || res.status === 403) return { ok: false, problem: 'Wildlife Network did not accept this station’s key.', sent, lastId, lastTime };
      if (!res.ok) return { ok: false, problem: 'Wildlife Network could not take the detections right now. BirdEcho tries again later.', sent, lastId, lastTime };
      const j = (await res.json().catch(() => ({}))) as { received?: number; rejected?: number };
      if (!j.received && j.rejected) return { ok: false, problem: 'Wildlife Network turned the detections down. Please tell us through Feedback.', sent, lastId, lastTime };
      sent += j.received ?? events.length;
    }
    const last = chunk[chunk.length - 1]!;
    lastId = last.id;
    lastTime = detectionTime(last) ?? lastTime;
  }
  return { ok: true, sent, read: items.length, lastId, lastTime };
}

// ── Storage ─────────────────────────────────────────────────────────────────

const key = (stationId: string) => `phoneShare:${stationId}`;

export async function getShareState(stationId: string): Promise<ShareState> {
  try {
    const raw = await AsyncStorage.getItem(key(stationId));
    return raw ? { ...EMPTY_STATE, ...(JSON.parse(raw) as Partial<ShareState>) } : EMPTY_STATE;
  } catch {
    return EMPTY_STATE;
  }
}

export async function saveShareState(stationId: string, s: ShareState): Promise<void> {
  await AsyncStorage.setItem(key(stationId), JSON.stringify(s));
}

/** The state after a run. */
export function afterRun(s: ShareState, r: ShareResult, now = new Date()): ShareState {
  return {
    ...s,
    lastId: r.lastId,
    lastTime: r.lastTime,
    lastRun: now.toISOString(),
    lastSent: r.sent > 0 ? now.toISOString() : s.lastSent,
    sent: s.sent + r.sent,
    problem: r.ok ? null : r.problem,
  };
}

/** True when a station is due for another run. */
export const due = (s: ShareState, now = Date.now()) => s.on && (!s.lastRun || now - Date.parse(s.lastRun) >= MIN_INTERVAL_MS);

// ── Runner ──────────────────────────────────────────────────────────────────

let running = false;

/**
 * Runs every BirdNET-Go station that has phone sharing on and is due. Called when the app starts and comes to the
 * front. Never throws.
 */
export async function sharePhoneStations(deps: {
  stations: { id: string; connectionType: string; hostUrl?: string; stationName?: string | null }[];
  getKey: (id: string) => Promise<string | null>;
  getDevice: (id: string) => Promise<string | null>;
  appVersion: string;
}): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (const st of deps.stations) {
      if (st.connectionType !== 'birdnetgo' || !st.hostUrl) continue;
      const state = await getShareState(st.id);
      if (!due(state)) continue;
      const [apiKey, deviceId] = await Promise.all([deps.getKey(st.id), deps.getDevice(st.id)]);
      if (!apiKey || !deviceId) continue;
      const r = await shareOnce({ hostUrl: st.hostUrl, apiKey, deviceId, stationName: st.stationName ?? null, appVersion: deps.appVersion }, state);
      // Re-read: the owner may have stopped sharing while this ran.
      const now = await getShareState(st.id);
      await saveShareState(st.id, afterRun({ ...now, lastId: state.lastId, lastTime: state.lastTime }, r));
    }
  } catch {
    // Storage errors: try again next time.
  } finally {
    running = false;
  }
}
