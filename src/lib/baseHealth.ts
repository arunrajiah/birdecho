/**
 * Base health, from whichever source the phone can reach: the Base's own /api/info (and /api/status) on the same
 * network, or Wildlife Network's GET /api/v1/devices/{deviceId}/health with the Base's own device key. Pure
 * (fetch passed in), so it runs under the Node test runner.
 */
import { WILDNETWORK_BASE } from './wildnetwork';

/** One health report, as Wildlife Network's health endpoint returns it (`latest` and each `history` entry). */
export interface HealthReport {
  at?: string | null;
  software?: Record<string, string | null> | null;
  uptimeSeconds?: number | null;
  boots?: number | null;
  temperatureC?: number | null;
  storage?: { freeMb?: number; totalMb?: number } | null;
  microphone?: { active?: boolean | null; lastDetectionAt?: string | null } | null;
  queue?: { pending?: number } | null;
  network?: { type?: string | null; signal?: number | string | null } | null;
}

export interface DeviceHealth {
  latest: HealthReport | null;
  history: HealthReport[];
}

/** What the Base page shows. Null means "not reported". */
export interface BaseHealth {
  at: string | null;
  temperatureC: number | null;
  uptimeSeconds: number | null;
  micActive: boolean | null;
  micProblem: string | null;
  lastDetectionAt: string | null;
  networkType: string | null;
  signal: number | string | null;
  queuePending: number | null;
  storage: { freeMb?: number; totalMb?: number } | null;
  battery: { percent?: number; charging?: boolean } | null;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

export function healthFromReport(r: HealthReport | null | undefined): BaseHealth | null {
  if (!r) return null;
  const mic = obj(r.microphone);
  const net = obj(r.network);
  return {
    at: str(r.at),
    temperatureC: num(r.temperatureC),
    uptimeSeconds: num(r.uptimeSeconds),
    micActive: typeof mic.active === 'boolean' ? mic.active : null,
    micProblem: null,
    lastDetectionAt: str(mic.lastDetectionAt),
    networkType: str(net.type),
    signal: num(net.signal) ?? str(net.signal),
    queuePending: num(obj(r.queue).pending),
    storage: r.storage ?? null,
    battery: null,
  };
}

/**
 * From the Base itself: /api/info (health fields being added in wildnetwork-base; today it has `microphone`
 * with `found` and `problem`) plus /api/status when it was read over the hotspot (temperature, uptime, queue,
 * network with uplink and cellular signal). Fields from /api/info win, /api/status fills the gaps.
 */
export function healthFromLocal(info: unknown, status?: unknown): BaseHealth {
  const i = obj(info);
  const s = obj(status);
  const mic = obj(i.microphone);
  const net = { ...obj(s.network), ...obj(i.network) };
  const cellular = obj(net.cellular);
  const active = typeof mic.active === 'boolean' ? mic.active : typeof mic.found === 'boolean' ? mic.found : null;
  const pick = (k: string) => num(i[k]) ?? num(s[k]);
  return {
    at: null,
    temperatureC: pick('temperatureC'),
    uptimeSeconds: pick('uptimeSeconds'),
    micActive: active,
    micProblem: str(mic.problem),
    lastDetectionAt: str(mic.lastDetectionAt) ?? str(i.lastDetectionAt),
    networkType: str(net.type) ?? str(net.uplink),
    signal: num(net.signal) ?? str(net.signal) ?? num(cellular.signalPercent),
    queuePending: num(obj(i.queue).pending) ?? num(obj(s.queue).pending),
    storage: (i.storage as BaseHealth['storage']) ?? (s.storage as BaseHealth['storage']) ?? null,
    battery: (i.battery as BaseHealth['battery']) ?? (s.battery as BaseHealth['battery']) ?? null,
  };
}

/** /api/info says this Base is a test station (not shown on the public map). */
export function isTestBase(info: unknown): boolean {
  return obj(info).test === true;
}

/** The warning shown when the microphone is not active, or null. Unknown (null) is not a warning. */
export function micWarning(h: Pick<BaseHealth, 'micActive' | 'micProblem'> | null): string | null {
  if (!h || h.micActive !== false) return null;
  const why = h.micProblem ? ` ${h.micProblem}` : '';
  return `The microphone is not active, so the Base hears no birds.${why} Check that the USB microphone is plugged in, then restart the Base.`;
}

export function formatUptime(seconds: number | null): string {
  if (seconds == null || seconds < 0) return 'not reported';
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  const unit = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  if (d > 0) return h % 24 ? `${unit(d, 'day')} ${unit(h % 24, 'hour')}` : unit(d, 'day');
  if (h > 0) return m % 60 ? `${unit(h, 'hour')} ${unit(m % 60, 'minute')}` : unit(h, 'hour');
  return unit(Math.max(m, 0), 'minute');
}

const NETWORK_NAMES: Record<string, string> = { wifi: 'Wi-Fi', '4g': '4G', '5g': '5G', '3g': '3G', ethernet: 'Ethernet', lte: '4G' };

/** "Wi-Fi, 72%", "4G, -85 dBm", "Ethernet", or "not reported". Numbers 0 to 100 are a percentage. */
export function formatSignal(type: string | null, signal: number | string | null): string {
  const name = type ? NETWORK_NAMES[type.toLowerCase()] ?? type : null;
  let level: string | null = null;
  if (typeof signal === 'number') level = signal < 0 ? `${signal} dBm` : signal <= 100 ? `${Math.round(signal)}%` : String(signal);
  else if (signal) level = signal;
  if (!name && !level) return 'not reported';
  return [name, level].filter(Boolean).join(', ');
}

/** "just now", "12 minutes ago", "3 hours ago", "2 days ago", or "never". */
export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'never';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'never';
  const m = Math.round((now - t) / 60000);
  return m < 2 ? 'just now' : `${duration(m)} ago`;
}

/** Minutes as "45 minutes", "3 hours" or "2 days" (the units ago() uses). */
function duration(m: number): string {
  if (m < 120) return `${m} minutes`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} hours` : `${Math.round(h / 24)} days`;
}

/** A Base that has not reported for longer than this gets a note on its page. */
export const STALE_REPORT_MS = 60 * 60_000;

/**
 * How long a Base has been silent ("3 hours"), when its last report to Wildlife Network is older than
 * STALE_REPORT_MS; null when it is recent or when it has never reported (the page already says so).
 */
export function staleReport(iso: string | null | undefined, now = Date.now()): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t) || now - t <= STALE_REPORT_MS) return null;
  return duration(Math.round((now - t) / 60000));
}

/**
 * Wildlife Network's health reports for a Base, with that Base's own device key (no other key works). Returns
 * null when the request fails or is refused; the page then falls back to the public device list.
 */
export async function fetchDeviceHealth(deviceId: string, apiKey: string, f: typeof fetch = fetch): Promise<DeviceHealth | null> {
  if (!deviceId || !apiKey) return null;
  try {
    const res = await f(`${WILDNETWORK_BASE}/api/v1/devices/${encodeURIComponent(deviceId)}/health`, {
      headers: { authorization: `Bearer ${apiKey}`, accept: 'application/json' },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Partial<DeviceHealth>;
    return { latest: j.latest ?? null, history: Array.isArray(j.history) ? j.history : [] };
  } catch {
    return null;
  }
}
