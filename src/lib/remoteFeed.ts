/**
 * A Base's Feed from Wildlife Network, for when the phone cannot reach the Base (or its linked BirdNET-Go) on the
 * local network: GET /api/v1/events?deployment=<system>:<deploymentId>. Pure (fetch passed in), so it runs under
 * the Node test runner.
 *
 * Ids: the Base's wdx-agent sends each BirdNET-Go detection as eventId "<source>:<station>:<record>"
 * (wdx-agent/wdx_agent.py read_birdnet_go), e.g. "birdnet-go:29ab78f229b9:d432", where <record> is "d<id>" for
 * current BirdNET-Go databases and the plain note id for older ones. The deployment is "<system>:<station>", e.g.
 * "wildnetwork-base:29ab78f229b9" (system = wildnetwork-base on a Base, /etc/wdx-agent.ini). <station> is a hash
 * of the Base's host name and machine id, which the phone cannot work out, so it is looked up (resolveDeployment).
 */
import type { Detection } from '../types/birdweather';
import { WILDNETWORK_BASE } from './wildnetwork';

/** How far back the Feed reaches when the station is out of reach and nothing newer was seen locally. */
export const REMOTE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const REMOTE_LIMIT = 500;
const BASE_SYSTEM = 'wildnetwork-base';

/** One feature of GET /api/v1/events. */
export interface WnEventFeature {
  geometry?: { coordinates?: [number, number] } | null;
  properties?: {
    id?: string;
    t?: string;
    sci?: string | null;
    common?: string | null;
    conf?: number | null;
    source?: string;
    deployment?: string | null;
    test?: boolean;
  };
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

/** The deployment of a WDX event as the server files it: source.system + ":" + deployment.deploymentId. */
export function deploymentOfEvent(ev: unknown): string | null {
  const system = obj(obj(ev).source).system;
  const id = obj(obj(ev).deployment).deploymentId;
  return typeof system === 'string' && system && typeof id === 'string' && id ? `${system}:${id}` : null;
}

/**
 * The detection part of an id, the same for a local BirdNET-Go item ("432") and its Wildlife Network copy
 * ("birdnet-go:29ab78f229b9:d432" or, from older databases, "birdnet-go:29ab78f229b9:432").
 */
export function recordKey(id: string): string {
  const last = id.slice(id.lastIndexOf(':') + 1);
  return /^d\d+$/.test(last) ? last.slice(1) : last;
}

/** Same detection: same record number and same species (guards against a note id equal to a newer detection id). */
function dedupeKey(d: Pick<Detection, 'id' | 'scientificName'>): string {
  return `${recordKey(d.id)}|${(d.scientificName ?? '').trim().toLowerCase()}`;
}

/** A Wildlife Network feature as a Feed item. No recording and no picture: both live only on the station. */
export function remoteDetection(f: WnEventFeature): Detection | null {
  const p = f.properties ?? {};
  if (!p.id || !p.t || !p.sci) return null;
  return {
    id: p.id,
    speciesId: p.sci,
    commonName: p.common || p.sci,
    scientificName: p.sci,
    timestamp: p.t,
    confidence: typeof p.conf === 'number' ? p.conf : 0,
    remote: true,
  };
}

const time = (d: Pick<Detection, 'timestamp'>) => {
  const t = Date.parse(d.timestamp);
  return Number.isFinite(t) ? t : 0;
};

/**
 * Local and Wildlife Network items in one list, newest first, each detection once. The local copy wins (it has
 * the recording). `cutoff` (ISO) drops Wildlife Network items older than it: pass the oldest loaded local item
 * while more local pages can still load, so remote items do not fill gaps the next page will cover.
 */
export function mergeFeed(local: Detection[], remote: Detection[], cutoff?: string | null): Detection[] {
  const seen = new Set(local.map(dedupeKey));
  const min = cutoff ? Date.parse(cutoff) : NaN;
  const extra = remote.filter((r) => {
    if (Number.isFinite(min) && time(r) < min) return false;
    const k = dedupeKey(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (!extra.length) return local;
  return [...local, ...extra].sort((a, b) => time(b) - time(a));
}

/**
 * Where the Wildlife Network request starts: the newest detection already shown (so only what the phone missed is
 * asked for) unless that is older than REMOTE_WINDOW_MS, rounded down to the hour so repeated requests share the
 * server's cache.
 */
export function remoteWindowStart(local: Pick<Detection, 'timestamp'>[], now = Date.now()): string {
  const newest = local.reduce((m, d) => Math.max(m, time(d)), 0);
  const start = Math.max(newest, now - REMOTE_WINDOW_MS);
  return new Date(Math.floor(start / 3_600_000) * 3_600_000).toISOString();
}

/**
 * One station's detections from Wildlife Network. With the Base's own device key, a test Base's detections are
 * included too (and the answer is never cached). Throws when the request fails.
 */
export async function fetchStationFeed(
  deployment: string,
  opts: { from: string; apiKey?: string | null; limit?: number },
  f: typeof fetch = fetch,
): Promise<Detection[]> {
  const q = `deployment=${encodeURIComponent(deployment)}&from=${encodeURIComponent(opts.from)}&limit=${opts.limit ?? REMOTE_LIMIT}`;
  const headers: Record<string, string> = { accept: 'application/json' };
  if (opts.apiKey) headers.authorization = `Bearer ${opts.apiKey}`;
  const res = await f(`${WILDNETWORK_BASE}/api/v1/events?${q}`, { headers });
  if (!res.ok) throw new Error(`Wildlife Network said ${res.status}.`);
  const j = (await res.json()) as { features?: WnEventFeature[] };
  return (Array.isArray(j.features) ? j.features : []).map(remoteDetection).filter((d): d is Detection => !!d);
}

/**
 * A test Base's deployment, from its own test detections (GET /api/v1/devices/{deviceId}/test-events, owner only).
 * Null when it has none or the request fails.
 */
export async function testDeployment(deviceId: string, apiKey: string, f: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await f(`${WILDNETWORK_BASE}/api/v1/devices/${encodeURIComponent(deviceId)}/test-events?limit=1`, {
      headers: { authorization: `Bearer ${apiKey}`, accept: 'application/json' },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { events?: unknown[] };
    return deploymentOfEvent(j.events?.[0]);
  } catch {
    return null;
  }
}

/**
 * The one Base deployment among public detections at the Base's position (the agent rounds positions to 0.01
 * degree). When several Bases share the spot, the one holding a detection the phone saw locally; else null.
 */
export function pickDeployment(features: WnEventFeature[], local: Pick<Detection, 'id' | 'scientificName'>[] = []): string | null {
  const deployments = new Set<string>();
  for (const f of features) {
    const d = f.properties?.deployment;
    if (d && d.startsWith(`${BASE_SYSTEM}:`)) deployments.add(d);
  }
  if (deployments.size <= 1) return [...deployments][0] ?? null;
  const seen = new Set(local.map(dedupeKey));
  const hits = new Set(
    features
      .filter((f) => f.properties?.deployment && deployments.has(f.properties.deployment))
      .filter((f) => {
        const d = remoteDetection(f);
        return !!d && seen.has(dedupeKey(d));
      })
      .map((f) => f.properties!.deployment!),
  );
  return hits.size === 1 ? [...hits][0]! : null;
}

/** A Base's deployment from public detections near its position over the last week. Null when unclear. */
export async function deploymentNear(
  lat: number,
  lon: number,
  local: Pick<Detection, 'id' | 'scientificName'>[],
  f: typeof fetch = fetch,
  now = Date.now(),
): Promise<string | null> {
  const r = (n: number) => Math.round(n * 1000) / 1000;
  const bbox = [r(lon - 0.02), r(lat - 0.02), r(lon + 0.02), r(lat + 0.02)].join(',');
  const from = remoteWindowStart([], now);
  try {
    const res = await f(`${WILDNETWORK_BASE}/api/v1/events?bbox=${bbox}&source=${BASE_SYSTEM}&from=${encodeURIComponent(from)}&limit=2000`);
    if (!res.ok) return null;
    const j = (await res.json()) as { features?: WnEventFeature[] };
    return pickDeployment(Array.isArray(j.features) ? j.features : [], local);
  } catch {
    return null;
  }
}

/** What the phone knows about the Base behind a station (a ManagedBase when this phone set it up). */
export interface BaseRef {
  deviceId?: string;
  apiKey?: string;
  latitude?: number;
  longitude?: number;
  deploymentId?: string;
}

/**
 * The Base's deployment on Wildlife Network: the one saved earlier, else from its test detections (needs its key),
 * else from public detections at its position. Null when none of these works (for example a Base set up on
 * another phone, or one that has sent nothing yet).
 */
export async function resolveDeployment(
  base: BaseRef | null,
  local: Pick<Detection, 'id' | 'scientificName'>[],
  f: typeof fetch = fetch,
): Promise<string | null> {
  if (!base) return null;
  if (base.deploymentId) return base.deploymentId;
  if (base.deviceId && base.apiKey) {
    const d = await testDeployment(base.deviceId, base.apiKey, f);
    if (d) return d;
  }
  if (typeof base.latitude === 'number' && typeof base.longitude === 'number') {
    return deploymentNear(base.latitude, base.longitude, local, f);
  }
  return null;
}
