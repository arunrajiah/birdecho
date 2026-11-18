/**
 * Offline data pickup from a Wildlife Network Base that has no 4G or Wi-Fi (wildnetwork-base README, "Data
 * pickup"): the phone joins the Base's hotspot, takes batches from GET /api/detections, stores each one on the
 * phone and only then acknowledges it with POST /api/ack. The stored detections wait in an outbox until the
 * phone has internet, then go to Wildlife Network (POST /api/v1/events, at most 5000 per request) with the
 * Base's own device key. Pure: every side effect is passed in, so it runs under the Node test runner.
 */

/** A WDX event as the Base hands it out; only eventId matters here. */
export interface PickupEvent {
  eventId: string;
  [k: string]: unknown;
}

/** GET /api/detections. `cursor` is null when nothing is waiting; a batch can have a cursor and no events. */
export interface PickupBatch {
  cursor: unknown;
  events: PickupEvent[];
}

export class SetupCodeError extends Error {}
export class StoreError extends Error {}

export interface PickupProgress {
  batches: number;
  collected: number;
}

export interface PickupDeps {
  fetchBatch: () => Promise<PickupBatch>;
  /** Store durably. Must resolve only once the events are safely on the phone. */
  store: (events: PickupEvent[]) => Promise<void>;
  ack: (cursor: unknown) => Promise<void>;
  onProgress?: (p: PickupProgress) => void;
  /** Failed fetches or acks in a row before giving up (the same batch is offered again each time). */
  maxFailures?: number;
  /** Safety stop. 2000 batches of 500 is a million detections. */
  maxBatches?: number;
  sleep?: (ms: number) => Promise<void>;
  retryMs?: number;
  cancelled?: () => boolean;
}

export interface PickupResult extends PickupProgress {
  done: boolean;
  error?: Error;
}

/**
 * Collect until the Base has nothing left. Order per batch: fetch, store, ack. A batch is never acknowledged
 * before it is stored; if the ack fails the Base offers the same batch again, it is stored again (the outbox
 * drops repeated eventIds) and acknowledged then. A wrong setup code or a storage failure stops at once.
 */
export async function runPickup(deps: PickupDeps): Promise<PickupResult> {
  const maxFailures = deps.maxFailures ?? 3;
  const maxBatches = deps.maxBatches ?? 2000;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const progress: PickupProgress = { batches: 0, collected: 0 };
  let failures = 0;
  let lastError: Error | undefined;

  while (progress.batches < maxBatches) {
    if (deps.cancelled?.()) return { ...progress, done: false };
    let batch: PickupBatch;
    try {
      batch = await deps.fetchBatch();
    } catch (e) {
      if (e instanceof SetupCodeError) return { ...progress, done: false, error: e };
      lastError = e instanceof Error ? e : new Error(String(e));
      if (++failures >= maxFailures) return { ...progress, done: false, error: lastError };
      await sleep(deps.retryMs ?? 1500);
      continue;
    }
    if (batch.cursor == null) return { ...progress, done: true };

    const events = Array.isArray(batch.events) ? batch.events.filter((e) => e && typeof e.eventId === 'string') : [];
    if (events.length) {
      try {
        await deps.store(events);
      } catch (e) {
        // Not stored, so not acknowledged: the Base keeps the batch.
        return { ...progress, done: false, error: new StoreError(e instanceof Error ? e.message : 'Could not save on this phone.') };
      }
    }
    try {
      await deps.ack(batch.cursor);
    } catch (e) {
      if (e instanceof SetupCodeError) return { ...progress, done: false, error: e };
      lastError = e instanceof Error ? e : new Error(String(e));
      if (++failures >= maxFailures) return { ...progress, done: false, error: lastError };
      await sleep(deps.retryMs ?? 1500);
      continue;
    }
    failures = 0;
    progress.batches += 1;
    progress.collected += events.length;
    deps.onProgress?.({ ...progress });
  }
  return { ...progress, done: false, error: new Error('Stopped after a very large number of batches. Tap Collect again to go on.') };
}

// ─── Outbox ───────────────────────────────────────────────────────────────────

export const MAX_UPLOAD = 5000;

/** Events in order, each eventId once (the first copy wins). */
export function dedupeEvents<T extends { eventId: string }>(events: T[]): T[] {
  const seen = new Set<string>();
  return events.filter((e) => (seen.has(e.eventId) ? false : (seen.add(e.eventId), true)));
}

/** The site refuses bodies over 10 MB; stay well under it. */
export const MAX_UPLOAD_BYTES = 8_000_000;

/** Requests of at most `size` events and about `maxBytes` of JSON each. */
export function chunk<T>(items: T[], size = MAX_UPLOAD, maxBytes = MAX_UPLOAD_BYTES): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  let bytes = 2;
  for (const item of items) {
    const b = JSON.stringify(item).length + 1;
    if (cur.length && (cur.length >= size || bytes + b > maxBytes)) {
      out.push(cur);
      cur = [];
      bytes = 2;
    }
    cur.push(item);
    bytes += b;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** One stored pickup batch, per Base. */
export interface OutboxEntry {
  id: string;
  baseId: string;
  events: PickupEvent[];
}

export interface OutboxStore {
  list: () => Promise<OutboxEntry[]>;
  add: (baseId: string, events: PickupEvent[]) => Promise<void>;
  /** Write `remaining` for the Base as one new entry first, then delete the entries `ids`. */
  replace: (baseId: string, ids: string[], remaining: PickupEvent[]) => Promise<void>;
}

/** Detections waiting per Base, each eventId counted once. */
export function outboxCounts(entries: OutboxEntry[]): Record<string, number> {
  const byBase: Record<string, PickupEvent[]> = {};
  for (const e of entries) (byBase[e.baseId] ??= []).push(...e.events);
  return Object.fromEntries(Object.entries(byBase).map(([b, ev]) => [b, dedupeEvents(ev).length]));
}

export type UploadOutcome = 'ok' | 'key' | 'rejected' | 'retry';

/** 2xx sent; 401/403 the key is not accepted (keep, tell the user); other 4xx the request itself is bad; else later. */
export function classifyUpload(status: number): UploadOutcome {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 401 || status === 403) return 'key';
  if (status >= 400 && status < 500 && status !== 408 && status !== 429) return 'rejected';
  return 'retry';
}

/** What POST /api/v1/events answered (its JSON body has received, rejected and rejectedDetails). */
export interface PostResult {
  status: number;
  received?: number;
  rejected?: number;
  details?: string[];
}

export interface UploadResult {
  sent: number;
  /** Events the site refused one by one (invalid WDX) while accepting others: dropped, they would be refused again. */
  refused: number;
  remaining: number;
  outcome: UploadOutcome | 'nothing';
}

/**
 * Send one Base's waiting detections, 5000 at a time. After each accepted request the outbox is rewritten
 * without those events (new entry first, then the old ones go), so a crash only means sending some again.
 */
export async function uploadBase(
  store: OutboxStore,
  baseId: string,
  post: (events: PickupEvent[]) => Promise<PostResult>,
): Promise<UploadResult> {
  const entries = (await store.list()).filter((e) => e.baseId === baseId);
  let pending = dedupeEvents(entries.flatMap((e) => e.events));
  if (!pending.length) return { sent: 0, refused: 0, remaining: 0, outcome: 'nothing' };
  let ids = entries.map((e) => e.id);
  let sent = 0;
  let refused = 0;
  for (const part of chunk(pending)) {
    let res: PostResult;
    try {
      res = await post(part);
    } catch {
      return { sent, refused, remaining: pending.length, outcome: 'retry' };
    }
    let outcome = classifyUpload(res.status);
    const bad = Math.min(res.rejected ?? 0, part.length);
    // A key for another source has every event refused: keep them all, it is the key that is wrong.
    if (outcome === 'ok' && (res.details ?? []).some((d) => /restricted to source\.system/.test(d))) outcome = 'key';
    // Nothing accepted at all: keep the events rather than drop a whole request.
    if (outcome === 'ok' && bad >= part.length) outcome = 'rejected';
    if (outcome !== 'ok') return { sent, refused, remaining: pending.length, outcome };
    sent += part.length - bad;
    refused += bad;
    pending = pending.slice(part.length);
    await store.replace(baseId, ids, pending);
    ids = (await store.list()).filter((e) => e.baseId === baseId).map((e) => e.id);
  }
  return { sent, refused, remaining: 0, outcome: 'ok' };
}
