import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBirdNetPiAdapter,
  parseDetectionRows,
  parseSpeciesButtons,
  parseStatsHtml,
} from '../src/api/adapters/birdnetpi';
import { fixture, mockFetch } from './helpers';

// Fixtures are real output of each fork's PHP, captured from a seeded station.
const FORKS = ['nachtzuster', 'mcguirepr89'] as const;
const BASE = 'http://pi.local';

/** A full 40-row page built from the fixture's first row, as the server would send it. */
function fullPage(fork: string): string {
  const html = fixture(`pi-${fork}-detections.html`);
  const [head, ...rows] = html.split(/(?=<tr\b)/);
  const row = rows[0]!;
  return head + Array.from({ length: 40 }, () => row).join('') + '</tr></table>';
}

for (const fork of FORKS) {
  describe(`BirdNET-Pi (${fork})`, () => {
    it('parses every detection row', () => {
      const rows = parseDetectionRows(fixture(`pi-${fork}-detections.html`), BASE);
      assert.equal(rows.length, 4);
      assert.deepEqual(
        {
          commonName: rows[0]!.commonName,
          scientificName: rows[0]!.scientificName,
          timestamp: rows[0]!.timestamp,
          confidence: rows[0]!.confidence,
        },
        {
          commonName: 'Blue Jay',
          scientificName: 'Cyanocitta cristata',
          timestamp: '2026-09-28T17:14:58',
          confidence: 0.77,
        },
      );
      for (const r of rows) {
        assert.match(r.soundscapeUrl ?? '', /^http:\/\/pi\.local\/By_Date\/2026-09-28\/.+\.mp3$/);
        assert.ok(!Number.isNaN(Date.parse(r.timestamp)), `bad timestamp ${r.timestamp}`);
        assert.ok(r.confidence > 0 && r.confidence <= 1);
      }
      assert.equal(new Set(rows.map((r) => r.id)).size, rows.length, 'ids must be unique');
    });

    it('keeps apostrophes in species names', () => {
      const rows = parseDetectionRows(fixture(`pi-${fork}-detections.html`), BASE);
      assert.ok(rows.some((r) => r.commonName === "Anna's Hummingbird"));
    });

    it('treats a day without detections as empty, not as an error', async () => {
      mockFetch([{ match: 'ajax_detections', body: fixture(`pi-${fork}-empty.html`) }]);
      const page = await createBirdNetPiAdapter(BASE).fetchRecentRecords();
      assert.deepEqual(page, { records: [], cursor: undefined });
    });

    it('pages through the feed in steps of 40', async () => {
      const requested = mockFetch([{ match: 'ajax_detections', body: fullPage(fork) }]);
      const adapter = createBirdNetPiAdapter(BASE);
      const first = await adapter.fetchRecentRecords();
      assert.equal(first.records.length, 40);
      await adapter.fetchRecentRecords(first.cursor);
      const pages = requested.filter((u) => u.includes('ajax_detections'));
      assert.match(pages[0]!, /display_limit=40$/);
      assert.match(pages[1]!, /display_limit=80$/);
    });

    it('reads the headline stats', () => {
      assert.deepEqual(parseStatsHtml(fixture(`pi-${fork}-stats.html`)), {
        totalRecords: 475,
        recordsToday: 95,
        uniqueSpecies: 5,
      });
    });

    it('lists every species the station has detected', async () => {
      mockFetch([
        { match: 'play.php?byspecies', body: fixture(`pi-${fork}-species.html`) },
        { match: 'ajax_detections', body: fixture(`pi-${fork}-detections.html`) },
      ]);
      const species = await createBirdNetPiAdapter(BASE).fetchTopSpecies(50);
      assert.equal(species.length, 5);
      assert.ok(species.every((s) => s.commonName && s.id));
      const jay = species.find((s) => s.commonName === 'Blue Jay')!;
      assert.equal(jay.scientificName, 'Cyanocitta cristata');
      assert.ok(jay.count > 0);
    });

    it('resolves a species by scientific or common name', async () => {
      mockFetch([
        { match: 'play.php?byspecies', body: fixture(`pi-${fork}-species.html`) },
        { match: 'ajax_detections', body: fixture(`pi-${fork}-detections.html`) },
        { match: '/api/v1/image/', body: '<html>dashboard</html>' },
      ]);
      const adapter = createBirdNetPiAdapter(BASE);
      assert.equal((await adapter.fetchSpecies('Cyanocitta cristata')).commonName, 'Blue Jay');
      assert.equal((await adapter.fetchSpecies('Blue Jay')).commonName, 'Blue Jay');
    });
  });
}

describe('BirdNET-Pi parser safety net', () => {
  it('reports rows it cannot read instead of showing an empty feed', async () => {
    const unknown = '<table><tr><td>17:14:58</td><td><span>Blue Jay</span></td></tr></table>';
    mockFetch([{ match: 'ajax_detections', body: unknown }]);
    await assert.rejects(
      createBirdNetPiAdapter(BASE).fetchRecentRecords(),
      /could not read the detection list/,
    );
  });

  it('reads counts from Nachtzuster species buttons, including the "k" form', () => {
    const html =
      '<button type="submit" name="species" value="Turdus migratorius">American Robin (1.2k)</button>' +
      '<button type="submit" name="species" value="Parus major">Great Tit (95)</button>';
    assert.deepEqual(parseSpeciesButtons(html), [
      { value: 'Turdus migratorius', commonName: 'American Robin', count: 1200, approximate: true },
      { value: 'Parus major', commonName: 'Great Tit', count: 95, approximate: false },
    ]);
  });

  it('builds the daily chart from per-date pages on Nachtzuster', async () => {
    mockFetch([
      { match: 'today_stats', body: fixture('pi-nachtzuster-stats.html') },
      { match: 'play.php?date=', body: fixture('pi-nachtzuster-date.html') },
    ]);
    const days = await createBirdNetPiAdapter(BASE).fetchDailyCounts(3);
    assert.deepEqual(
      days.map((d) => d.count),
      [95, 95, 95],
    );
  });

  it('replaces rounded "13.6k" counts with the exact total', async () => {
    const species =
      '<button type="submit" name="species" value="Chaetura pelagica">Chimney Swift (13.6k)</button>';
    const perDay = JSON.stringify([
      { date: '2026-09-27', count: 13000 },
      { date: '2026-09-28', count: 643 },
    ]);
    mockFetch([
      { match: 'play.php?byspecies', body: species },
      { match: 'ajax_detections', body: fixture('pi-nachtzuster-empty.html') },
      { match: 'comname=Chimney%20Swift', body: perDay, contentType: 'text/html' },
      { match: '/api/v1/image/', body: '<html>dashboard</html>' },
      { match: 'wikipedia.org', body: '{}' },
    ]);
    const sp = await createBirdNetPiAdapter(BASE).fetchSpecies('Chaetura pelagica');
    assert.equal(sp.count, 13643);
  });

  it('uses the Wikipedia thumbnail, with a User-Agent, instead of a full-size original', async () => {
    let userAgent: string | null = null;
    mockFetch([
      { match: 'ajax_detections', body: fixture('pi-nachtzuster-detections.html') },
      {
        match: '/api/v1/image/',
        body: JSON.stringify({ data: { image_url: 'https://upload.wikimedia.org/wikipedia/commons/9/97/Big.jpg' } }),
      },
      {
        match: 'wikipedia.org/api/rest_v1/page/summary/',
        body: JSON.stringify({ thumbnail: { source: 'https://upload.wikimedia.org/thumb/330px-Big.jpg' } }),
      },
    ]);
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string, init?: RequestInit) => {
      if (String(input).includes('wikipedia.org')) {
        userAgent = new Headers(init?.headers).get('User-Agent');
      }
      return realFetch(input, init);
    }) as typeof fetch;
    const page = await createBirdNetPiAdapter(BASE).fetchRecentRecords();
    assert.ok(page.records.every((r) => r.imageUrl === 'https://upload.wikimedia.org/thumb/330px-Big.jpg'));
    assert.match(userAgent ?? '', /^BirdEcho/);
  });

  it('keeps a Flickr image from the station as is', async () => {
    mockFetch([
      { match: 'ajax_detections', body: fixture('pi-nachtzuster-detections.html') },
      { match: '/api/v1/image/', body: JSON.stringify({ data: { image_url: 'https://live.staticflickr.com/1/2_b.jpg' } }) },
    ]);
    const page = await createBirdNetPiAdapter(BASE).fetchRecentRecords();
    assert.equal(page.records[0]!.imageUrl, 'https://live.staticflickr.com/1/2_b.jpg');
  });
});
