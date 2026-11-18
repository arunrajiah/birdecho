import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ago,
  fetchDeviceHealth,
  formatSignal,
  formatUptime,
  healthFromLocal,
  healthFromReport,
  isTestBase,
  micWarning,
} from '../src/lib/baseHealth';
import { baseLocalUrl } from '../src/lib/baseStation';
import { fixture } from './helpers';

// Shape of GET https://wlnw.org/api/v1/devices/{deviceId}/health (latest and each history entry).
const latest = {
  at: '2026-11-19T08:00:00Z',
  software: { wnbase: '0.2.0', 'wdx-agent': '0.4.2' },
  uptimeSeconds: 93_600,
  boots: 3,
  temperatureC: 51.2,
  storage: { freeMb: 20_100, totalMb: 29_000 },
  microphone: { active: true, lastDetectionAt: '2026-11-19T07:52:00Z' },
  queue: { pending: 4 },
  network: { type: 'wifi', signal: 72 },
};

describe('Base health from Wildlife Network', () => {
  it('reads the health report', () => {
    const h = healthFromReport(latest)!;
    assert.equal(h.at, latest.at);
    assert.equal(h.micActive, true);
    assert.equal(h.lastDetectionAt, '2026-11-19T07:52:00Z');
    assert.equal(h.temperatureC, 51.2);
    assert.equal(h.uptimeSeconds, 93_600);
    assert.equal(h.queuePending, 4);
    assert.deepEqual([h.networkType, h.signal], ['wifi', 72]);
    assert.equal(healthFromReport(null), null);
  });

  it('sends only the Base\'s own key and gives up quietly when refused', async () => {
    let seen: { url: string; auth: string | null } | null = null;
    const ok = (async (url: string, init: RequestInit) => {
      seen = { url, auth: new Headers(init.headers).get('authorization') };
      return new Response(JSON.stringify({ latest, history: [latest, latest] }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await fetchDeviceHealth('wnb_test', 'wn_key', ok);
    assert.deepEqual(seen, { url: 'https://wlnw.org/api/v1/devices/wnb_test/health', auth: 'Bearer wn_key' });
    assert.equal(r?.history.length, 2);

    const refused = (async () => new Response('{"error":"forbidden"}', { status: 403 })) as unknown as typeof fetch;
    assert.equal(await fetchDeviceHealth('wnb_test', 'other', refused), null);
    const never = (async () => { throw new Error('should not be called'); }) as unknown as typeof fetch;
    assert.equal(await fetchDeviceHealth('wnb_test', '', never), null);
  });
});

describe('Base health from the Base itself', () => {
  it('reads /api/info as it is today (microphone found or not, with the reason)', () => {
    const info = JSON.parse(fixture('base-info-registered.json')) as Record<string, unknown>;
    const h = healthFromLocal({ ...info, microphone: { found: false, problem: 'No sound card that can record is connected.' } });
    assert.equal(h.micActive, false);
    assert.match(micWarning(h)!, /microphone is not active.*No sound card/);
    assert.equal(healthFromLocal(info).micActive, null);
  });

  it('prefers new /api/info fields and fills gaps from /api/status', () => {
    const h = healthFromLocal(
      { model: 'wildnetwork-base', test: true, uptimeSeconds: 600, microphone: { active: true, lastDetectionAt: '2026-11-19T07:00:00Z' } },
      { temperatureC: 48, uptimeSeconds: 1, queue: { pending: 9 }, network: { uplink: '4g', cellular: { signalPercent: 61 } } },
    );
    assert.equal(h.uptimeSeconds, 600);
    assert.equal(h.temperatureC, 48);
    assert.equal(h.queuePending, 9);
    assert.equal(h.micActive, true);
    assert.equal(formatSignal(h.networkType, h.signal), '4G, 61%');
  });

  it('knows a test station', () => {
    assert.equal(isTestBase({ test: true }), true);
    assert.equal(isTestBase({ test: 'yes' }), false);
    assert.equal(isTestBase(null), false);
  });

  it('remembers where to reach the Base on the home network', () => {
    const info = { hostname: 'wildnetwork-base-7a8d' };
    assert.equal(baseLocalUrl('http://192.168.1.11', info), 'http://192.168.1.11');
    assert.equal(baseLocalUrl('http://10.42.0.1', info), 'http://wildnetwork-base-7a8d.local');
  });
});

describe('Health wording', () => {
  it('warns only when the microphone is known to be off', () => {
    assert.equal(micWarning({ micActive: true, micProblem: null }), null);
    assert.equal(micWarning({ micActive: null, micProblem: null }), null);
    assert.ok(micWarning({ micActive: false, micProblem: null }));
  });

  it('formats uptime, signal and times', () => {
    assert.equal(formatUptime(93_600), '1 day 2 hours');
    assert.equal(formatUptime(3 * 86_400), '3 days');
    assert.equal(formatUptime(3_900), '1 hour 5 minutes');
    assert.equal(formatUptime(59), '0 minutes');
    assert.equal(formatUptime(null), 'not reported');
    assert.equal(formatSignal('wifi', 72), 'Wi-Fi, 72%');
    assert.equal(formatSignal('4g', -85), '4G, -85 dBm');
    assert.equal(formatSignal('ethernet', null), 'Ethernet');
    assert.equal(formatSignal(null, null), 'not reported');
    const now = Date.parse('2026-11-19T08:00:00Z');
    assert.equal(ago('2026-11-19T07:52:00Z', now), '8 minutes ago');
    assert.equal(ago(null, now), 'never');
  });

  it('has no em dashes in what it shows', () => {
    const text = [micWarning({ micActive: false, micProblem: 'x' }), formatUptime(93_600), formatSignal('4g', 61)].join(' ');
    assert.equal(/—/.test(text), false);
  });
});
