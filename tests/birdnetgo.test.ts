import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createBirdNetGoAdapter } from '../src/api/adapters/birdnetgo';
import { fixture, mockFetch } from './helpers';

// Fixtures are real /api/v2 responses from a BirdNET-Go server.
const BASE = 'http://go.local:8080';

describe('BirdNET-Go', () => {
  it('maps the detection feed', async () => {
    mockFetch([{ match: '/detections?', body: fixture('go-detections.json') }]);
    const page = await createBirdNetGoAdapter(BASE).fetchRecentRecords();
    assert.equal(page.records.length, 3);
    const first = page.records[0]!;
    assert.equal(first.commonName, 'American Robin');
    assert.equal(first.scientificName, 'Turdus migratorius');
    assert.ok(!Number.isNaN(Date.parse(first.timestamp)));
    assert.equal(page.cursor, '3');
  });

  it('plays audio by detection id, not by clip file name', async () => {
    mockFetch([{ match: '/detections?', body: fixture('go-detections.json') }]);
    const page = await createBirdNetGoAdapter(BASE).fetchRecentRecords();
    assert.equal(page.records[0]!.soundscapeUrl, `${BASE}/api/v2/audio/${page.records[0]!.id}`);
  });

  it('asks for one species using the scientific name behind a species code', async () => {
    const requested = mockFetch([
      { match: '/analytics/species/summary', body: fixture('go-species-summary.json') },
      { match: '/detections?', body: fixture('go-detections-species.json') },
    ]);
    const records = await createBirdNetGoAdapter(BASE).fetchRecordsForSpecies('gretit1', 3);
    const query = new URL(requested.find((u) => u.includes('/detections?'))!).searchParams;
    assert.equal(query.get('species'), 'Parus major');
    assert.equal(query.get('queryType'), 'species');
    assert.equal(records.length, 3);
    assert.ok(records.every((r) => r.scientificName === 'Parus major'));
  });

  it('never shows other species when the server ignores the filter', async () => {
    mockFetch([{ match: '/detections?', body: fixture('go-detections.json') }]);
    const records = await createBirdNetGoAdapter(BASE).fetchRecordsForSpecies('Parus major', 3);
    assert.deepEqual(records, []);
  });

  it('computes stats from the species summary and daily total', async () => {
    mockFetch([
      { match: '/analytics/species/summary', body: fixture('go-species-summary.json') },
      { match: '/analytics/time/daily', body: fixture('go-daily.json') },
    ]);
    assert.deepEqual(await createBirdNetGoAdapter(BASE).fetchStats(), {
      totalRecords: 260,
      uniqueSpecies: 6,
      recordsToday: 47,
    });
  });
});
