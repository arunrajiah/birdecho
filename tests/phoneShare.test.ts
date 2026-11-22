import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_STATE, afterRun, detectionTime, due, readNew, shareOnce, toWdx, type BngItem } from '../src/lib/phoneShare';

const now = Date.parse('2026-11-22T12:00:00Z');
const item = (id: number, extra: Partial<BngItem> = {}): BngItem => ({
  id,
  timestamp: new Date(now - (100 - id) * 60_000).toISOString().replace('.000Z', '+00:00'),
  scientificName: 'Copsychus saularis',
  commonName: 'Oriental Magpie-Robin',
  confidence: 0.9,
  latitude: 13.08274,
  longitude: 80.27071,
  ...extra,
});
const opts = { stationId: 'wnd_abc', stationName: 'Garden', appVersion: '0.18.0', fallback: null };

describe('toWdx', () => {
  it('matches what wdx-agent sends for a BirdNET-Go station', () => {
    const e = toWdx(item(42), opts) as Record<string, any>;
    assert.equal(e.eventId, 'birdnet-go:wnd_abc:42');
    assert.equal(e.source.system, 'birdnet-go');
    assert.equal(e.source.systemVersion, 'birdecho/0.18.0');
    assert.equal(e.deployment.deploymentId, 'wnd_abc');
    assert.equal(e.deployment.latitude, 13.08);
    assert.equal(e.deployment.longitude, 80.27);
    assert.equal(e.detection.scientificName, 'Copsychus saularis');
    assert.equal(e.review.status, 'unreviewed');
  });
  it('keeps the true instant from a timestamp with a zone', () => {
    assert.equal(detectionTime(item(1, { timestamp: '2026-11-22T10:30:00+05:30' })), '2026-11-22T05:00:00Z');
  });
  it('leaves out low confidence, wrong, timeless and placeless detections', () => {
    assert.equal(toWdx(item(1, { confidence: 0.69 }), opts), null);
    assert.equal(toWdx(item(1, { verified: 'false_positive' }), opts), null);
    assert.equal(toWdx(item(1, { unlikely: true }), opts), null);
    assert.equal(toWdx(item(1, { timestamp: undefined }), opts), null);
    assert.equal(toWdx(item(1, { latitude: 0, longitude: 0 }), opts), null);
    const fb = toWdx(item(1, { latitude: undefined, longitude: undefined }), { ...opts, fallback: { lat: 51.5123, lon: -0.1234 } }) as Record<string, any>;
    assert.equal(fb.deployment.latitude, 51.51);
    assert.equal((toWdx(item(1, { verified: 'correct' }), opts) as Record<string, any>).review.status, 'confirmed');
  });
});

describe('readNew', () => {
  const pages = (all: BngItem[]) => async (offset: number) => all.slice().sort((a, b) => b.id - a.id).slice(offset, offset + 100);
  it('reads only what is newer than the last one sent, oldest first', async () => {
    const all = Array.from({ length: 250 }, (_, i) => item(i + 1, { timestamp: new Date(now - (250 - i) * 1000).toISOString() }));
    const got = await readNew(pages(all), 120, now);
    assert.equal(got.length, 130);
    assert.equal(got[0]!.id, 121);
    assert.equal(got.at(-1)!.id, 250);
  });
  it('starts with the last 7 days on the first share', async () => {
    const old = item(1, { timestamp: new Date(now - 8 * 86_400_000).toISOString() });
    const recent = item(2, { timestamp: new Date(now - 86_400_000).toISOString() });
    assert.deepEqual((await readNew(pages([old, recent]), null, now)).map((d) => d.id), [2]);
  });
});

function fakeFetch(detections: BngItem[], answer: (body: unknown[]) => Response) {
  const posts: unknown[][] = [];
  const f = (async (url: string, init?: RequestInit) => {
    if (url.startsWith('http://station')) {
      const offset = Number(new URL(url).searchParams.get('offset'));
      const data = detections.slice().sort((a, b) => b.id - a.id).slice(offset, offset + 100);
      return new Response(JSON.stringify({ data }), { status: 200 });
    }
    const body = JSON.parse(String(init?.body)) as unknown[];
    posts.push(body);
    return answer(body);
  }) as unknown as typeof fetch;
  return { f, posts };
}
const target = { hostUrl: 'http://station:8080/', apiKey: 'wn_k', deviceId: 'wnd_abc', stationName: 'Garden', appVersion: '0.18.0' };

describe('shareOnce', () => {
  it('uploads new detections and moves on to the newest one', async () => {
    const { f, posts } = fakeFetch([item(5), item(6, { confidence: 0.3 }), item(7)], (b) => new Response(JSON.stringify({ received: b.length, rejected: 0 })));
    const r = await shareOnce(target, { ...EMPTY_STATE, on: true, lastId: 4 }, f, now);
    assert.ok(r.ok);
    assert.equal(r.sent, 2);
    assert.equal(r.lastId, 7);
    assert.equal(posts.length, 1);
    assert.equal(posts[0]!.length, 2);
  });
  it('does not move on when Wildlife Network refuses the key', async () => {
    const { f } = fakeFetch([item(5)], () => new Response('{}', { status: 401 }));
    const r = await shareOnce(target, { ...EMPTY_STATE, on: true, lastId: 4 }, f, now);
    assert.ok(!r.ok && r.problem.includes('key'));
    assert.equal(r.lastId, 4);
  });
  it('says so when the station is out of reach', async () => {
    const f = (async () => { throw new TypeError('network'); }) as unknown as typeof fetch;
    const r = await shareOnce(target, { ...EMPTY_STATE, on: true }, f, now);
    assert.ok(!r.ok && r.problem.includes('same Wi-Fi'));
  });
  it('asks for a place when the station gives none', async () => {
    const { f, posts } = fakeFetch([item(5, { latitude: undefined, longitude: undefined })], () => new Response('{}'));
    const r = await shareOnce(target, { ...EMPTY_STATE, on: true, lastId: 4 }, f, now);
    assert.ok(!r.ok && r.problem.includes('location'));
    assert.equal(posts.length, 0);
    assert.equal(r.lastId, 4);
  });
});

describe('state', () => {
  it('counts what was sent and waits 10 minutes between runs', () => {
    const s = afterRun({ ...EMPTY_STATE, on: true }, { ok: true, sent: 3, read: 3, lastId: 9, lastTime: '2026-11-22T11:00:00Z' }, new Date(now));
    assert.equal(s.sent, 3);
    assert.equal(s.lastId, 9);
    assert.equal(s.problem, null);
    assert.ok(!due(s, now + 5 * 60_000));
    assert.ok(due(s, now + 11 * 60_000));
    assert.ok(!due({ ...s, on: false }, now + 11 * 60_000));
  });
});
