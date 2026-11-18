/**
 * How Wildlife Network Bases and saved stations relate. Pure functions (no native code), so they run under
 * the Node test runner. A Base runs BirdNET-Go on port 8080 and its own setup API on port 80
 * (wildnetwork-base/base/birdnet-go-unit.sh, wnbase.py); its wdx-agent already sends detections to
 * Wildlife Network.
 */
import type { SavedStation } from '../types/station';
import type { BaseInfo } from './baseApi';

export const BASE_BIRDNET_GO_PORT = 8080;
const HOTSPOT_HOST = '10.42.0.1';

interface Parsed {
  scheme: string;
  host: string;
  port: number;
}

/** Split "http://host:port/path" without the URL class (React Native's URL lacks hostname and port). */
function parse(url: string): Parsed | null {
  const m = /^(https?):\/\/(\[[^\]]+\]|[^/:?#\s]+)(?::(\d+))?/i.exec(url.trim());
  if (!m) return null;
  const scheme = m[1]!.toLowerCase();
  return { scheme, host: m[2]!.toLowerCase(), port: m[3] ? Number(m[3]) : scheme === 'https' ? 443 : 80 };
}

/** True when two station addresses point at the same host and port ("http://a:80/" equals "http://a"). */
export function sameAddress(a: string | undefined, b: string | undefined): boolean {
  const pa = a ? parse(a) : null;
  const pb = b ? parse(b) : null;
  return !!pa && !!pb && pa.scheme === pb.scheme && pa.host === pb.host && pa.port === pb.port;
}

/** The Base's setup API (port 80) on the same host as a BirdNET-Go address, e.g. http://192.168.1.50:8080. */
export function baseApiUrlFor(hostUrl: string): string | null {
  const p = parse(hostUrl);
  return p ? `${p.scheme}://${p.host}` : null;
}

/** True when /api/info says BirdNET-Go is installed on the Base (software.birdnetGo is its version). */
export function baseHasBirdNetGo(info: Pick<BaseInfo, 'software'>): boolean {
  return !!info.software?.birdnetGo;
}

/**
 * Where the phone will find the Base's BirdNET-Go later. When the app reached the Base on the home network,
 * that address with port 8080. On the Base's own hotspot (10.42.0.1) the address stops working once the
 * phone leaves it, so use the Base's host name on the local network (<hostname>.local).
 */
export function baseFeedUrl(baseUrl: string, info: Pick<BaseInfo, 'hostname'>): string | null {
  const p = parse(baseUrl);
  if (!p) return null;
  if (p.host !== HOTSPOT_HOST) return `${p.scheme}://${p.host}:${BASE_BIRDNET_GO_PORT}`;
  const name = info.hostname?.trim().toLowerCase();
  if (!name || !/^[a-z0-9-]+$/.test(name)) return null;
  return `http://${name}.local:${BASE_BIRDNET_GO_PORT}`;
}

export type BaseStationPlan =
  | { kind: 'none' }
  | { kind: 'link'; stationId: string }
  | { kind: 'add'; hostUrl: string; stationName: string };

/**
 * What to do with the station list after a Base is set up: nothing (no BirdNET-Go, no usable address, or a
 * station is already linked), link an existing station at the same address, or add a BirdNET-Go station.
 */
export function planBaseStation(
  stations: SavedStation[],
  base: { hardwareId: string; name: string },
  info: Pick<BaseInfo, 'software' | 'hostname'>,
  baseUrl: string,
): BaseStationPlan {
  if (!baseHasBirdNetGo(info)) return { kind: 'none' };
  if (stations.some((s) => s.baseId === base.hardwareId)) return { kind: 'none' };
  const hostUrl = baseFeedUrl(baseUrl, info);
  if (!hostUrl) return { kind: 'none' };
  const existing = stations.find((s) => s.connectionType === 'birdnetgo' && sameAddress(s.hostUrl, hostUrl));
  if (existing) return { kind: 'link', stationId: existing.id };
  return { kind: 'add', hostUrl, stationName: base.name };
}

/** A station that is a Base's own BirdNET-Go: the Base already shares its detections through wdx-agent. */
export function isBaseStation(station: Pick<SavedStation, 'baseId'> | null | undefined): boolean {
  return !!station?.baseId;
}

export type RemovalOutcome = 'remove' | 'last-keep-bases' | 'last-reset';

/** What removing a station does, and the confirmation shown before it. */
export function planRemoval(
  stations: SavedStation[],
  stationId: string,
  baseCount: number,
): { outcome: RemovalOutcome; title: string; message: string; confirm: string } {
  const station = stations.find((s) => s.id === stationId);
  const name = station?.stationName ?? 'this station';
  const last = stations.filter((s) => s.id !== stationId).length === 0;
  const baseNote = isBaseStation(station)
    ? ' The Base keeps recording and sharing with Wildlife Network; this phone only stops showing its detections.'
    : '';
  if (!last) {
    return { outcome: 'remove', title: 'Remove station', message: `Remove "${name}" from BirdEcho?${baseNote}`, confirm: 'Remove' };
  }
  if (baseCount > 0) {
    const bases = baseCount === 1 ? 'Your Base stays' : `Your ${baseCount} Bases stay`;
    return {
      outcome: 'last-keep-bases',
      title: 'Remove your last station?',
      message: `"${name}" is your only station.${baseNote} ${bases} saved under Settings, Bases, and BirdEcho stays open, but the Feed is empty until you add a device.`,
      confirm: 'Remove',
    };
  }
  return {
    outcome: 'last-reset',
    title: 'Remove your last station?',
    message: `"${name}" is your only station.${baseNote} Removing it takes BirdEcho back to the welcome screen, where you can connect a device again.`,
    confirm: 'Remove and start over',
  };
}

/** Where the app opens: the Feed with a station, Settings when only Bases are saved, else the welcome screen. */
export function startRoute(hasStation: boolean, baseCount: number): 'feed' | 'settings' | 'welcome' {
  if (hasStation) return 'feed';
  return baseCount > 0 ? 'settings' : 'welcome';
}
