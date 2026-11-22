/**
 * The pickup outbox on the phone: one JSON file per stored batch under <documents>/pickup-outbox/, written to a
 * temporary name and then moved, so a file is either complete or absent. Files, not AsyncStorage: Android's
 * AsyncStorage database is small (about 6 MB) and a long pickup can be larger. The pickup and upload logic is in
 * pickup.ts; this file only does the storage and the upload request.
 */
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBases } from './secureStorage';
import { WILDNETWORK_BASE } from './wildnetwork';
import { outboxCounts, uploadBase, type OutboxEntry, type OutboxStore, type PickupEvent, type UploadResult } from './pickup';

const DIR = `${FileSystem.documentDirectory ?? ''}pickup-outbox/`;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

let seq = 0;
function newId(baseId: string) {
  return `${baseId.replace(/[^A-Za-z0-9_-]/g, '')}-${Date.now().toString(36)}-${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function writeEntry(baseId: string, events: PickupEvent[]) {
  await ensureDir();
  const id = newId(baseId);
  const tmp = `${DIR}${id}.tmp`;
  await FileSystem.writeAsStringAsync(tmp, JSON.stringify({ baseId, events }));
  await FileSystem.moveAsync({ from: tmp, to: `${DIR}${id}.json` });
}

export const fileOutbox: OutboxStore = {
  async list() {
    await ensureDir();
    const names = (await FileSystem.readDirectoryAsync(DIR)).filter((n) => n.endsWith('.json')).sort();
    const out: OutboxEntry[] = [];
    for (const n of names) {
      try {
        const j = JSON.parse(await FileSystem.readAsStringAsync(DIR + n)) as { baseId?: string; events?: PickupEvent[] };
        if (j.baseId && Array.isArray(j.events)) out.push({ id: n, baseId: j.baseId, events: j.events });
      } catch {
        // An unreadable file is left alone rather than deleted.
      }
    }
    return out;
  },
  async add(baseId, events) {
    if (events.length) await writeEntry(baseId, events);
  },
  async replace(baseId, ids, remaining) {
    if (remaining.length) await writeEntry(baseId, remaining);
    for (const id of ids) await FileSystem.deleteAsync(DIR + id, { idempotent: true });
  },
};

/** Detections waiting to upload, per Base hardware id. */
export async function waitingCounts(): Promise<Record<string, number>> {
  return outboxCounts(await fileOutbox.list());
}

// ─── Last pickup (small, so AsyncStorage) ─────────────────────────────────────

const lastKey = (baseId: string) => `pickup_last_${baseId}`;

export interface LastPickup {
  at: string;
  collected: number;
  batches: number;
}

export async function getLastPickup(baseId: string): Promise<LastPickup | null> {
  try {
    const raw = await AsyncStorage.getItem(lastKey(baseId));
    return raw ? (JSON.parse(raw) as LastPickup) : null;
  } catch {
    return null;
  }
}

export async function setLastPickup(baseId: string, p: LastPickup): Promise<void> {
  await AsyncStorage.setItem(lastKey(baseId), JSON.stringify(p));
}

// ─── Upload ───────────────────────────────────────────────────────────────────

async function postEvents(apiKey: string, events: PickupEvent[]) {
  const res = await fetch(`${WILDNETWORK_BASE}/api/v1/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(events),
  });
  const j = (await res.json().catch(() => ({}))) as { received?: number; rejected?: number; rejectedDetails?: { errors?: string[] }[] };
  return {
    status: res.status,
    received: j.received,
    rejected: j.rejected,
    details: (j.rejectedDetails ?? []).flatMap((d) => d.errors ?? []),
  };
}

let flushing: Promise<Record<string, UploadResult>> | null = null;

/**
 * Send every Base's waiting detections that this phone holds the key for. Safe to call often (app start,
 * back in the foreground, after a pickup): one run at a time, and failures just leave the outbox for next time.
 */
export function flushOutbox(): Promise<Record<string, UploadResult>> {
  flushing ??= (async () => {
    const results: Record<string, UploadResult> = {};
    try {
      const counts = await waitingCounts();
      // Nothing waiting (the usual case): skip reading the Bases from secure storage.
      if (!Object.keys(counts).length) return results;
      const bases = await getBases();
      for (const baseId of Object.keys(counts)) {
        const key = bases.find((b) => b.hardwareId === baseId)?.apiKey;
        if (!key) continue;
        results[baseId] = await uploadBase(fileOutbox, baseId, (ev) => postEvents(key, ev));
      }
    } catch {
      // Storage or network trouble: try again next time.
    }
    return results;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
