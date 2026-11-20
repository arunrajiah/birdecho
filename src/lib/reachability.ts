/**
 * Whether a station on the local network (a Base's BirdNET-Go, BirdNET-Pi) can be reached from where the phone is,
 * decided without waiting for a request to fail. Pure, so it runs under the Node test runner.
 *
 * A phone on mobile data that asks a private address (for example http://10.91.248.31:8080) gets no answer at all:
 * the request hangs until the OS gives up (about a minute on iOS), and React Query's retries made that minutes.
 * So local requests get a short timeout, and the Feed treats the station as out of reach at once when the phone
 * has no Wi-Fi, or is on a Wi-Fi whose /24 differs from the station's address.
 */

/** Requests to a station on the local network give up after this long. */
export const LOCAL_TIMEOUT_MS = 4000;

/** What the phone knows about its own connection (expo-network). `type` uses expo-network's NetworkStateType values. */
export interface PhoneNetwork {
  type?: string | null;
  isConnected?: boolean | null;
  /** The phone's IPv4 address on Wi-Fi (expo-network getIpAddressAsync); anything else is ignored. */
  ip?: string | null;
}

export type StationReach =
  | { outOfReach: true; reason: 'no-network' | 'no-wifi' | 'other-network' }
  | { outOfReach: false; reason: 'not-local' | 'unknown' | 'same-network' | 'wifi' };

/** The four numbers of an IPv4 literal, or null. */
export function ipv4(s: string | null | undefined): number[] | null {
  if (!s) return null;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s.trim());
  if (!m) return null;
  const n = m.slice(1).map(Number);
  return n.every((x) => x <= 255) ? n : null;
}

/** 10/8, 172.16/12, 192.168/16 and link-local 169.254/16: addresses only reachable on the same network. */
export function isPrivateIPv4(n: number[]): boolean {
  const [a, b] = n as [number, number];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

/** The host name of a station URL, or null when it cannot be parsed. */
export function stationHost(hostUrl: string | null | undefined): string | null {
  if (!hostUrl) return null;
  const m = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(\[[^\]]*\]|[^/:?#]+)/i.exec(hostUrl.trim());
  return m ? m[1]!.toLowerCase() : null;
}

/**
 * True when the host is only reachable on a local network: a private IPv4 literal, a .local (Bonjour) name, or a
 * single-label name. A public address or domain (port forwarding, a tunnel) may answer over mobile data too.
 */
export function isLocalHost(host: string): boolean {
  const n = ipv4(host);
  if (n) return isPrivateIPv4(n);
  if (host.startsWith('[')) return /^\[(fe80:|fc|fd)/i.test(host);
  return host.endsWith('.local') || !host.includes('.');
}

/**
 * Whether the station at `hostUrl` is out of reach from the phone's current connection. Only says "out of reach"
 * when sure: no connection, mobile data only, or Wi-Fi on another /24 than the station's private IPv4 address.
 * When the station host is a name (.local) or the phone's address is unknown, the subnet check is skipped. A VPN or
 * an unknown connection type is never judged, since the station may be reachable through it.
 */
export function stationReach(hostUrl: string | null | undefined, net: PhoneNetwork | null | undefined): StationReach {
  const host = stationHost(hostUrl);
  if (!host || !isLocalHost(host)) return { outOfReach: false, reason: 'not-local' };
  if (!net || !net.type || net.type === 'UNKNOWN') return { outOfReach: false, reason: 'unknown' };
  if (net.type === 'NONE' || net.isConnected === false) return { outOfReach: true, reason: 'no-network' };
  if (net.type === 'CELLULAR' || net.type === 'BLUETOOTH' || net.type === 'WIMAX') return { outOfReach: true, reason: 'no-wifi' };
  if (net.type !== 'WIFI' && net.type !== 'ETHERNET') return { outOfReach: false, reason: 'unknown' };
  const station = ipv4(host);
  const phone = ipv4(net.ip);
  if (!station || !phone || !isPrivateIPv4(phone)) return { outOfReach: false, reason: 'wifi' };
  const same = station[0] === phone[0] && station[1] === phone[1] && station[2] === phone[2];
  return same ? { outOfReach: false, reason: 'same-network' } : { outOfReach: true, reason: 'other-network' };
}

/** What the Feed does with a station linked to a Base, from what is known so far. */
export interface FeedSources {
  /** Ask Wildlife Network for the station's detections now (while the station is tried, or after it failed). */
  remote: boolean;
  /** The station is out of reach: show the fallback note. */
  unreachable: boolean;
}

/**
 * `answered` = the station's own request succeeded since the Feed opened; `failed` = it failed (timeout, error);
 * `outOfReach` = stationReach() said so. Without a Base nothing comes from Wildlife Network.
 */
export function feedSources(o: { baseId?: string | null; outOfReach: boolean; answered: boolean; failed: boolean }): FeedSources {
  if (!o.baseId || o.answered) return { remote: false, unreachable: false };
  return { remote: true, unreachable: o.outOfReach || o.failed };
}

/**
 * fetch() that rejects after `ms` even if the request never settles (aborting it when the platform supports that).
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  ms = LOCAL_TIMEOUT_MS,
  f: typeof fetch = fetch,
): Promise<Response> {
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ctrl.abort();
      reject(new Error(`No answer within ${Math.round(ms / 1000)} seconds.`));
    }, ms);
  });
  try {
    return await Promise.race([f(url, { ...init, signal: ctrl.signal }), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
