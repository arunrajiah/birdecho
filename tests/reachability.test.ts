import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { feedSources, fetchWithTimeout, isLocalHost, stationHost, stationReach } from '../src/lib/reachability';
import { mergeFeed, remoteDetection } from '../src/lib/remoteFeed';
import type { Detection } from '../src/types/birdweather';

const BASE = 'http://10.91.248.31:8080';

describe('stationReach', () => {
  it('no Wi-Fi: a station on a private address is out of reach at once', () => {
    assert.deepEqual(stationReach(BASE, { type: 'CELLULAR', isConnected: true }), { outOfReach: true, reason: 'no-wifi' });
    assert.deepEqual(stationReach(BASE, { type: 'NONE', isConnected: false }), { outOfReach: true, reason: 'no-network' });
    assert.equal(stationReach('http://birdnet-base.local:8080', { type: 'CELLULAR', isConnected: true }).outOfReach, true);
  });

  it('Wi-Fi on a different network than the station is out of reach', () => {
    assert.deepEqual(stationReach(BASE, { type: 'WIFI', isConnected: true, ip: '192.168.1.23' }), {
      outOfReach: true,
      reason: 'other-network',
    });
    assert.equal(stationReach(BASE, { type: 'WIFI', isConnected: true, ip: '10.91.249.7' }).outOfReach, true);
  });

  it('Wi-Fi on the same /24 is tried', () => {
    assert.deepEqual(stationReach(BASE, { type: 'WIFI', isConnected: true, ip: '10.91.248.77' }), {
      outOfReach: false,
      reason: 'same-network',
    });
  });

  it('skips the subnet check when it cannot judge: .local name, unknown phone address, VPN, unknown network', () => {
    assert.equal(stationReach('http://birdnet-base.local:8080', { type: 'WIFI', ip: '192.168.1.23' }).outOfReach, false);
    assert.equal(stationReach(BASE, { type: 'WIFI', ip: null }).outOfReach, false);
    assert.equal(stationReach(BASE, { type: 'WIFI', ip: '0.0.0.0' }).outOfReach, false);
    assert.equal(stationReach(BASE, { type: 'VPN', isConnected: true }).outOfReach, false);
    assert.equal(stationReach(BASE, null).outOfReach, false);
    assert.equal(stationReach(BASE, { type: 'UNKNOWN' }).outOfReach, false);
  });

  it('never judges a public station, which may answer over mobile data', () => {
    assert.equal(stationReach('https://birds.example.org', { type: 'CELLULAR', isConnected: true }).outOfReach, false);
    assert.equal(stationReach('http://203.0.113.5:8080', { type: 'CELLULAR', isConnected: true }).outOfReach, false);
  });

  it('parses hosts', () => {
    assert.equal(stationHost('http://10.91.248.31:8080/'), '10.91.248.31');
    assert.equal(stationHost('Base.Local:8080'), 'base.local');
    assert.equal(isLocalHost('172.20.1.1'), true);
    assert.equal(isLocalHost('172.32.1.1'), false);
    assert.equal(isLocalHost('raspberrypi'), true);
  });
});

describe('feedSources', () => {
  it('out of reach: Wildlife Network at once, before the station request fails', () => {
    assert.deepEqual(feedSources({ baseId: 'b1', outOfReach: true, answered: false, failed: false }), { remote: true, unreachable: true });
  });

  it('while the station is tried, Wildlife Network loads too, without the out of reach note', () => {
    assert.deepEqual(feedSources({ baseId: 'b1', outOfReach: false, answered: false, failed: false }), { remote: true, unreachable: false });
  });

  it('station request failed (timeout): out of reach', () => {
    assert.deepEqual(feedSources({ baseId: 'b1', outOfReach: false, answered: false, failed: true }), { remote: true, unreachable: true });
  });

  it('the station answers: no more requests to Wildlife Network', () => {
    assert.deepEqual(feedSources({ baseId: 'b1', outOfReach: true, answered: true, failed: false }), { remote: false, unreachable: false });
  });

  it('no Base: nothing from Wildlife Network', () => {
    assert.deepEqual(feedSources({ baseId: undefined, outOfReach: true, answered: false, failed: true }), { remote: false, unreachable: false });
  });
});

describe('fetchWithTimeout', () => {
  it('gives up on a station request that hangs', async () => {
    let aborted = false;
    const hang = ((_u: string, init?: RequestInit) => {
      init?.signal?.addEventListener('abort', () => (aborted = true));
      return new Promise<Response>(() => {});
    }) as typeof fetch;
    const t0 = Date.now();
    await assert.rejects(fetchWithTimeout(`${BASE}/api/v2/detections`, {}, 50, hang), /No answer/);
    assert.ok(Date.now() - t0 < 1000);
    assert.equal(aborted, true);
  });

  it('gives up even when the request ignores the abort signal', async () => {
    const deaf = (() => new Promise<Response>(() => {})) as typeof fetch;
    await assert.rejects(fetchWithTimeout(BASE, {}, 30, deaf), /No answer/);
  });

  it('passes an answer through', async () => {
    const ok = (async () => new Response('{}', { status: 200 })) as typeof fetch;
    assert.equal((await fetchWithTimeout(BASE, {}, 1000, ok)).status, 200);
  });
});

describe('station coming back', () => {
  const local = (id: string, timestamp: string): Detection => ({
    id,
    speciesId: 'amerob',
    commonName: 'American Robin',
    scientificName: 'Turdus migratorius',
    timestamp,
    confidence: 0.9,
    soundscapeUrl: `${BASE}/api/v2/audio/${id}`,
  });
  const remote = (record: string, t: string) =>
    remoteDetection({
      properties: { id: `birdnet-go:29ab78f229b9:${record}`, t, sci: 'Turdus migratorius', common: 'American Robin', conf: 0.9 },
    })!;

  it('merges the cached Wildlife Network items with the station list, each detection once', () => {
    // Shown while out of reach: three detections from Wildlife Network.
    const cached = [remote('d10', '2026-11-20T10:00:00Z'), remote('d11', '2026-11-20T10:05:00Z'), remote('d12', '2026-11-20T10:10:00Z')];
    // The station answers with two of them plus a newer one.
    const back = [local('13', '2026-11-20T10:15:00Z'), local('12', '2026-11-20T10:10:00Z'), local('11', '2026-11-20T10:05:00Z')];
    const sources = feedSources({ baseId: 'b1', outOfReach: false, answered: true, failed: false });
    assert.equal(sources.unreachable, false);
    const out = mergeFeed(back, cached);
    assert.deepEqual(out.map((d) => d.id), ['13', '12', '11', 'birdnet-go:29ab78f229b9:d10']);
    assert.equal(out.filter((d) => d.remote).length, 1);
  });
});
