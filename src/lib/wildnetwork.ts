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
