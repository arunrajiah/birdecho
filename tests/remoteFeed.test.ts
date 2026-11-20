import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  deploymentOfEvent,
  fetchStationFeed,
  mergeFeed,
  pickDeployment,
  recordKey,
  remoteDetection,
  remoteWindowStart,
  resolveDeployment,
  type WnEventFeature,
} from '../src/lib/remoteFeed';
import type { Detection } from '../src/types/birdweather';

// Shape of GET https://wlnw.org/api/v1/events?deployment=wildnetwork-base:29ab78f229b9 (one feature).
const feature = (record: string, t: string, sci = 'Turdus migratorius', extra: Record<string, unknown> = {}): WnEventFeature => ({
  geometry: { coordinates: [-71.06, 42.36] },
  properties: {
    id: `birdnet-go:29ab78f229b9:${record}`,
    t,
    sci,
    common: 'American Robin',
    conf: 0.91,
    source: 'wildnetwork-base',
    deployment: 'wildnetwork-base:29ab78f229b9',
    ...extra,
  },
});

const local = (id: string, timestamp: string, scientificName = 'Turdus migratorius'): Detection => ({
  id,
  speciesId: 'amerob',
  commonName: 'American Robin',
  scientificName,
  timestamp,
  confidence: 0.91,
  soundscapeUrl: `http://base.local:8080/api/v2/audio/${id}`,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('remote feed ids', () => {
  it('matches a local BirdNET-Go id to the agent eventId, current and older databases', () => {
    assert.equal(recordKey('birdnet-go:29ab78f229b9:d432'), '432');
    assert.equal(recordKey('birdnet-go:29ab78f229b9:432'), '432');
    assert.equal(recordKey('432'), '432');
  });

  it('reads the deployment from a WDX event the way the server files it', () => {
    const ev = { eventId: 'birdnet-go:29ab78f229b9:d432', source: { system: 'wildnetwork-base' }, deployment: { deploymentId: '29ab78f229b9' } };
    assert.equal(deploymentOfEvent(ev), 'wildnetwork-base:29ab78f229b9');
    assert.equal(deploymentOfEvent({ source: { system: 'x' } }), null);
    assert.equal(deploymentOfEvent(undefined), null);
  });

  it('marks Wildlife Network items remote, without recording or picture', () => {
    const d = remoteDetection(feature('d432', '2026-11-20T10:00:00.000Z'))!;
    assert.equal(d.remote, true);
    assert.equal(d.soundscapeUrl, undefined);
    assert.equal(d.imageUrl, undefined);
    assert.equal(remoteDetection({ properties: { id: 'x' } }), null);
  });
});

describe('mergeFeed', () => {
  const r432 = remoteDetection(feature('d432', '2026-11-20T10:00:00.000Z'))!;
  const r433 = remoteDetection(feature('d433', '2026-11-20T10:05:00.000Z'))!;

  it('keeps the local copy (with its recording) and adds only what the phone missed, newest first', () => {
    const out = mergeFeed([local('432', '2026-11-20T11:00:00+01:00')], [r432, r433]);
    assert.deepEqual(out.map((d) => d.id), ['birdnet-go:29ab78f229b9:d433', '432']);
    assert.equal(out[1]!.remote, undefined);
  });

  it('does not treat a different species with the same number as the same detection', () => {
    const out = mergeFeed([local('432', '2026-11-20T11:00:00+01:00', 'Cardinalis cardinalis')], [r432]);
    assert.equal(out.length, 2);
  });

  it('drops remote duplicates and remote items older than the cutoff', () => {
    const out = mergeFeed([], [r433, r433, r432], '2026-11-20T10:01:00Z');
    assert.deepEqual(out.map((d) => d.id), ['birdnet-go:29ab78f229b9:d433']);
  });

  it('returns the local list unchanged when nothing is added', () => {
    const l = [local('432', '2026-11-20T11:00:00+01:00')];
    assert.equal(mergeFeed(l, [r432]), l);
  });
});

describe('remote window and fetch', () => {
  const now = Date.parse('2026-11-20T12:34:00Z');

  it('starts at the newest local detection, else 7 days back, on the hour', () => {
    assert.equal(remoteWindowStart([{ timestamp: '2026-11-20T09:20:00Z' }], now), '2026-11-20T09:00:00.000Z');
    assert.equal(remoteWindowStart([{ timestamp: '2026-10-01T09:20:00Z' }], now), '2026-11-13T12:00:00.000Z');
    assert.equal(remoteWindowStart([], now), '2026-11-13T12:00:00.000Z');
  });

  it('asks for the deployment with the Base key and maps the features', async () => {
    const seen: { url: string; auth?: string }[] = [];
    const f = (async (url: string, init?: RequestInit) => {
      seen.push({ url, auth: (init?.headers as Record<string, string>)?.authorization });
      return json({ type: 'FeatureCollection', features: [feature('d432', '2026-11-20T10:00:00.000Z', undefined, { test: true })] });
    }) as typeof fetch;
    const out = await fetchStationFeed('wildnetwork-base:29ab78f229b9', { from: '2026-11-13T12:00:00.000Z', apiKey: 'wn_key' }, f);
    assert.equal(out.length, 1);
    assert.equal(
      seen[0]!.url,
      'https://wlnw.org/api/v1/events?deployment=wildnetwork-base%3A29ab78f229b9&from=2026-11-13T12%3A00%3A00.000Z&limit=500',
    );
    assert.equal(seen[0]!.auth, 'Bearer wn_key');
  });

  it('throws when Wildlife Network refuses', async () => {
    const f = (async () => json({ error: 'x' }, 500)) as unknown as typeof fetch;
    await assert.rejects(fetchStationFeed('wildnetwork-base:a', { from: 'x' }, f));
  });
});

describe('finding the deployment', () => {
  it('picks the one Base deployment at the spot, or the one matching a local detection', () => {
    const other = feature('d9', '2026-11-20T10:00:00Z', 'Turdus migratorius', { id: 'birdnet-go:ffff:d9', deployment: 'wildnetwork-base:ffff' });
    const pi = feature('1', '2026-11-20T10:00:00Z', 'Turdus migratorius', { deployment: 'birdnet-pi:abc' });
    assert.equal(pickDeployment([feature('d432', '2026-11-20T10:00:00Z'), pi]), 'wildnetwork-base:29ab78f229b9');
    assert.equal(pickDeployment([feature('d432', '2026-11-20T10:00:00Z'), other]), null);
    assert.equal(pickDeployment([feature('d432', '2026-11-20T10:00:00Z'), other], [local('432', 'x')]), 'wildnetwork-base:29ab78f229b9');
    assert.equal(pickDeployment([]), null);
  });

  it('uses the saved id, then the test detections (with the key), then public detections at the position', async () => {
    assert.equal(await resolveDeployment({ deploymentId: 'wildnetwork-base:saved' }, []), 'wildnetwork-base:saved');
    assert.equal(await resolveDeployment(null, []), null);

    const urls: string[] = [];
    const f = (async (url: string) => {
      urls.push(url);
      if (url.includes('/test-events')) {
        return json({ events: [{ eventId: 'birdnet-go:29ab78f229b9:d432', source: { system: 'wildnetwork-base' }, deployment: { deploymentId: '29ab78f229b9' } }] });
      }
      return json({ features: [] });
    }) as typeof fetch;
    assert.equal(
      await resolveDeployment({ deviceId: 'wnd_x', apiKey: 'k', latitude: 42.36, longitude: -71.06 }, [], f),
      'wildnetwork-base:29ab78f229b9',
    );
    assert.match(urls[0]!, /\/api\/v1\/devices\/wnd_x\/test-events\?limit=1$/);

    const g = (async (url: string) => {
      urls.push(url);
      if (url.includes('/test-events')) return json({ events: [] });
      return json({ features: [feature('d432', '2026-11-20T10:00:00Z')] });
    }) as typeof fetch;
    urls.length = 0;
    assert.equal(await resolveDeployment({ deviceId: 'wnd_x', apiKey: 'k', latitude: 42.36, longitude: -71.06 }, [], g), 'wildnetwork-base:29ab78f229b9');
    assert.match(urls[1]!, /bbox=-71\.08,42\.34,-71\.04,42\.38&source=wildnetwork-base/);
  });
});
