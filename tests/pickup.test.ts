import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SetupCodeError,
  StoreError,
  MAX_UPLOAD,
  chunk,
  classifyUpload,
  dedupeEvents,
  outboxCounts,
  runPickup,
  uploadBase,
  type OutboxEntry,
  type OutboxStore,
  type PickupBatch,
  type PickupEvent,
} from '../src/lib/pickup';
import { ackDetections, getDetections } from '../src/lib/baseApi';

const ev = (n: number): PickupEvent => ({ wdx: '0.2', eventId: `wildnetwork-base:wnb_1:d${n}`, source: { system: 'wildnetwork-base' } });
const noSleep = async () => undefined;

/**
 * A fake Base with the same rules as wnbase.py: GET /api/detections serves the queue from the acknowledged
 * position, POST /api/ack only takes the cursor of the last answer (else 409) and moves the queue past it.
 */
function fakeBase(rows: (PickupEvent | null)[], batch = 2) {
  let pos = 0;
  let served: number | null = null;
  const log: string[] = [];
  return {
    log,
    fetchBatch: async (): Promise<PickupBatch> => {
      log.push('fetch');
      const slice = rows.slice(pos, pos + batch);
      served = slice.length ? pos + slice.length : null;
      return { cursor: served == null ? null : { d: served }, events: slice.filter((e): e is PickupEvent => !!e) };
    },
    ack: async (cursor: unknown) => {
      log.push('ack');
      const d = (cursor as { d: number }).d;
      if (served == null || d !== served) throw new Error('409 cursor does not match');
      pos = d;
      served = null;
    },
    get pos() {
      return pos;
    },
  };
}

function memoryStore(): OutboxStore & { entries: OutboxEntry[] } {
  let n = 0;
  const entries: OutboxEntry[] = [];
  return {
    entries,
    list: async () => entries.map((e) => ({ ...e, events: [...e.events] })),
    add: async (baseId, events) => {
      entries.push({ id: `e${n++}`, baseId, events });
    },
    replace: async (baseId, ids, remaining) => {
      if (remaining.length) entries.push({ id: `e${n++}`, baseId, events: remaining });
      for (const id of ids) entries.splice(entries.findIndex((e) => e.id === id), 1);
    },
  };
}

describe('Collecting from a Base', () => {
  it('stores each batch before acknowledging it, and stops at an empty batch', async () => {
    const base = fakeBase([ev(1), ev(2), ev(3)]);
    const stored: string[][] = [];
    const r = await runPickup({
      fetchBatch: base.fetchBatch,
      store: async (events) => {
        base.log.push('store');
        stored.push(events.map((e) => e.eventId));
      },
      ack: base.ack,
      sleep: noSleep,
    });
    assert.deepEqual(r, { batches: 2, collected: 3, done: true });
    assert.deepEqual(base.log, ['fetch', 'store', 'ack', 'fetch', 'store', 'ack', 'fetch']);
    assert.equal(stored.flat().length, 3);
  });

  it('never acknowledges a batch it could not store', async () => {
    const base = fakeBase([ev(1), ev(2)]);
    const r = await runPickup({ fetchBatch: base.fetchBatch, store: async () => { throw new Error('disk full'); }, ack: base.ack, sleep: noSleep });
    assert.ok(r.error instanceof StoreError);
    assert.equal(r.done, false);
    assert.equal(base.log.includes('ack'), false);
    assert.equal(base.pos, 0, 'the Base keeps the batch');
  });

  it('acknowledges a batch with a cursor and no events (skipped rows) and goes on', async () => {
    const base = fakeBase([null, null, ev(3)]);
    const r = await runPickup({ fetchBatch: base.fetchBatch, store: async () => undefined, ack: base.ack, sleep: noSleep });
    assert.deepEqual(r, { batches: 2, collected: 1, done: true });
  });

  it('retries the same batch after a failed ack, and the outbox keeps each detection once', async () => {
    const base = fakeBase([ev(1), ev(2), ev(3)]);
    const store = memoryStore();
    let failOnce = true;
    const r = await runPickup({
      fetchBatch: base.fetchBatch,
      store: (events) => store.add('hw1', events),
      ack: async (c) => {
        if (failOnce) {
          failOnce = false;
          throw new Error('connection reset');
        }
        await base.ack(c);
      },
      sleep: noSleep,
    });
    assert.equal(r.done, true);
    assert.deepEqual(base.log.slice(0, 2), ['fetch', 'fetch'], 'the batch was offered again');
    assert.equal(store.entries.length, 3, 'stored twice, then the second batch');
    assert.deepEqual(outboxCounts(store.entries), { hw1: 3 });
  });

  it('gives up after repeated failures and stops at once on a wrong setup code', async () => {
    const down = await runPickup({ fetchBatch: async () => { throw new Error('unreachable'); }, store: async () => undefined, ack: async () => undefined, sleep: noSleep, maxFailures: 3 });
    assert.equal(down.done, false);
    assert.match(down.error!.message, /unreachable/);
    let acks = 0;
    const base = fakeBase([ev(1)]);
    const wrong = await runPickup({ fetchBatch: base.fetchBatch, store: async () => undefined, ack: async () => { acks++; throw new SetupCodeError('wrong code'); }, sleep: noSleep });
    assert.ok(wrong.error instanceof SetupCodeError);
    assert.equal(acks, 1);
  });
});

describe('Outbox', () => {
  it('drops repeated eventIds, keeping the first copy', () => {
    const a = { ...ev(1), n: 'first' };
    assert.deepEqual(dedupeEvents([a, ev(2), { ...ev(1), n: 'second' }]).map((e) => [e.eventId, e.n]), [
      [a.eventId, 'first'],
      [ev(2).eventId, undefined],
    ]);
  });

  it('chunks at 5000 events per request, and by size for big events', () => {
    const many = Array.from({ length: 12_001 }, (_, i) => ev(i));
    assert.deepEqual(chunk(many).map((c) => c.length), [5000, 5000, 2001]);
    assert.equal(MAX_UPLOAD, 5000);
    const big = Array.from({ length: 10 }, (_, i) => ({ ...ev(i), pad: 'x'.repeat(1000) }));
    assert.ok(chunk(big, 5000, 3000).every((c) => JSON.stringify(c).length <= 3000));
    assert.deepEqual(chunk([]), []);
  });

  it('classifies upload answers', () => {
    assert.equal(classifyUpload(200), 'ok');
    assert.equal(classifyUpload(401), 'key');
    assert.equal(classifyUpload(400), 'rejected');
    assert.equal(classifyUpload(429), 'retry');
    assert.equal(classifyUpload(503), 'retry');
  });

  it('uploads in chunks and removes only what was sent', async () => {
    const store = memoryStore();
    await store.add('hw1', Array.from({ length: 6000 }, (_, i) => ev(i)));
    await store.add('hw1', [ev(1), ev(6000)]); // a repeat and one new
    await store.add('other', [ev(1)]);
    const sizes: number[] = [];
    let call = 0;
    const r = await uploadBase(store, 'hw1', async (events) => {
      sizes.push(events.length);
      return ++call === 1 ? { status: 200, received: 5000, rejected: 0 } : { status: 503 };
    });
    assert.deepEqual(sizes, [5000, 1001]);
    assert.deepEqual(r, { sent: 5000, refused: 0, remaining: 1001, outcome: 'retry' });
    assert.deepEqual(outboxCounts(store.entries), { hw1: 1001, other: 1 });

    const again = await uploadBase(store, 'hw1', async () => ({ status: 200, received: 1000, rejected: 1 }));
    assert.deepEqual(again, { sent: 1000, refused: 1, remaining: 0, outcome: 'ok' });
    assert.deepEqual(outboxCounts(store.entries), { other: 1 });
  });

  it('keeps everything when the key is wrong or nothing was accepted', async () => {
    const store = memoryStore();
    await store.add('hw1', [ev(1), ev(2)]);
    const wrongSource = await uploadBase(store, 'hw1', async () => ({
      status: 200, received: 0, rejected: 2, details: ['key is restricted to source.system=birdnet-go'],
    }));
    assert.equal(wrongSource.outcome, 'key');
    assert.equal((await uploadBase(store, 'hw1', async () => ({ status: 401 }))).outcome, 'key');
    assert.equal((await uploadBase(store, 'hw1', async () => ({ status: 200, rejected: 2 }))).outcome, 'rejected');
    assert.equal((await uploadBase(store, 'hw1', async () => { throw new Error('offline'); })).outcome, 'retry');
    assert.deepEqual(outboxCounts(store.entries), { hw1: 2 });
    assert.equal((await uploadBase(store, 'none', async () => ({ status: 200 }))).outcome, 'nothing');
  });
});

describe('Base pickup API', () => {
  it('asks for a batch and acknowledges with the cursor and the setup code', async () => {
    const calls: { url: string; method: string; code: string | null; body: unknown }[] = [];
    globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
      calls.push({ url, method: init.method ?? 'GET', code: new Headers(init.headers).get('x-setup-code'), body: init.body ? JSON.parse(String(init.body)) : null });
      const body = url.includes('/api/ack') ? { ok: true, advanced: true } : { cursor: { d: 4 }, events: [ev(4)] };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    const b = await getDetections('http://10.42.0.1', 9999);
    assert.deepEqual(b.cursor, { d: 4 });
    await ackDetections('http://10.42.0.1', 'ABCD2345', b.cursor);
    assert.deepEqual(calls, [
      { url: 'http://10.42.0.1/api/detections?limit=500', method: 'GET', code: null, body: null },
      { url: 'http://10.42.0.1/api/ack', method: 'POST', code: 'ABCD2345', body: { cursor: { d: 4 } } },
    ]);
  });

  it('reports a wrong setup code with its status', async () => {
    globalThis.fetch = (async () => new Response('{"error":"wrong setup code"}', { status: 403 })) as unknown as typeof fetch;
    await assert.rejects(ackDetections('http://10.42.0.1', 'ABCD2345', { d: 1 }), (e: { status?: number }) => e.status === 403);
  });
});
