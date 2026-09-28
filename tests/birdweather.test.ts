import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createBirdWeatherAdapter } from '../src/api/adapters/birdweather';
import { fetchStation } from '../src/api/station';
import { fixture, mockFetch } from './helpers';

// Fixtures are real app.birdweather.com/api/v1 responses (coordinates scrubbed).
const DAILY = JSON.stringify({
  data: {
    dailyDetectionCounts: [
      { date: '2026-09-28', total: 342 },
      { date: '2026-09-27', total: 385 },
    ],
  },
});

describe('BirdWeather', () => {
  it('reads the station object', async () => {
    mockFetch([{ match: '/stations/2000', body: fixture('bw-station.json') }]);
    const station = await fetchStation('2000', 'token');
    assert.equal(station.id, '2000');
    assert.equal(station.name, 'Example Station');
  });

  it('maps the detection feed', async () => {
    mockFetch([{ match: '/detections?', body: fixture('bw-detections.json') }]);
    const page = await createBirdWeatherAdapter('2000').fetchRecentRecords();
    assert.equal(page.records.length, 3);
    for (const r of page.records) {
      assert.ok(r.commonName && r.scientificName && r.speciesId);
      assert.ok(!Number.isNaN(Date.parse(r.timestamp)));
    }
  });

  it('filters detections with speciesId, the parameter the API honours', async () => {
    const requested = mockFetch([
      { match: '/detections?', body: fixture('bw-detections-species.json') },
    ]);
    const records = await createBirdWeatherAdapter('2000').fetchRecordsForSpecies('77', 3);
    assert.equal(new URL(requested[0]!).searchParams.get('speciesId'), '77');
    assert.equal(records.length, 3);
    assert.ok(records.every((r) => r.commonName === 'Blue Jay'));
  });

  it('never shows other species when the filter is ignored', async () => {
    mockFetch([{ match: '/detections?', body: fixture('bw-detections.json') }]);
    const records = await createBirdWeatherAdapter('2000').fetchRecordsForSpecies('77', 3);
    assert.ok(records.every((r) => r.speciesId === '77'));
  });

  it('lists all-time species, not just the ones heard today', async () => {
    const requested = mockFetch([{ match: '/species?', body: fixture('bw-species.json') }]);
    const species = await createBirdWeatherAdapter('2000').fetchTopSpecies(50);
    assert.equal(new URL(requested[0]!).searchParams.get('period'), 'all');
    assert.equal(species.length, 3);
    assert.ok(species[0]!.count >= species[1]!.count);
  });

  it('still opens a species that is missing from the station list', async () => {
    mockFetch([
      { match: '/stations/2000/species?', body: '{"success":true,"species":[]}' },
      { match: '/species/77', body: fixture('bw-species-global.json') },
    ]);
    const species = await createBirdWeatherAdapter('2000').fetchSpecies('77');
    assert.equal(species.commonName, 'Blue Jay');
    assert.equal(species.count, 0);
  });

  it('fills the daily chart from per-day totals', async () => {
    mockFetch([{ match: '/graphql', body: DAILY }]);
    const days = await createBirdWeatherAdapter('2000').fetchDailyCounts(3);
    assert.deepEqual(days, [
      { date: '2026-09-26', count: 0 },
      { date: '2026-09-27', count: 385 },
      { date: '2026-09-28', count: 342 },
    ]);
  });

  it('falls back to today only when per-day totals are unavailable', async () => {
    mockFetch([
      { match: '/graphql', body: '{"errors":[]}', status: 500 },
      { match: '/stats?period=day', body: '{"success":true,"detections":12,"species":3}' },
    ]);
    const days = await createBirdWeatherAdapter('2000').fetchDailyCounts(2);
    assert.equal(days.length, 2);
    assert.equal(days[1]!.count, 12);
  });
});
