/**
 * BirdNET-Pi direct HTTP adapter.
 *
 * BirdNET-Pi runs an Apache/Caddy + PHP web server; detections are stored in
 * SQLite. Unlike BirdNET-Go there is no JSON REST API — the primary endpoints
 * return HTML table fragments, which we parse with regex. One endpoint
 * (per-species daily counts) returns real JSON.
 *
 * Two forks are supported:
 *   - mcguirepr89/BirdNET-Pi   — HTML-only, no images API
 *   - Nachtzuster/BirdNET-Pi   — adds /api/v1/image/{Sci_Name} (Flickr) and
 *                                /play.php?getlabels=true (JSON species list)
 *
 * Auth: HTTP Basic Auth is required only for admin/write paths (/scripts/*,
 * /stream, /Processed/*, etc.). All read endpoints used here are public.
 *
 * @see https://github.com/mcguirepr89/BirdNET-Pi
 * @see https://github.com/Nachtzuster/BirdNET-Pi
 */

import { ApiError } from '../../lib/apiClient';
import type { StationAdapter } from '../adapter';
import type { Detection, RecordsPage, Species, Stats } from '../../types/birdweather';

// ── Low-level fetch helpers ─────────────────────────────────────────────────

async function bpiGetHtml(base: string, path: string): Promise<string> {
  const url = `${base}${path}`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error('Could not reach BirdNET-Pi station — check the host URL and your network.');
  }
  if (!response.ok) {
    throw new ApiError(response.status, `BirdNET-Pi error ${response.status}`);
  }
  return response.text();
}

async function bpiGetJson<T>(base: string, path: string): Promise<T> {
  const url = `${base}${path}`;
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error('Could not reach BirdNET-Pi station — check the host URL and your network.');
  }
  if (!response.ok) {
    throw new ApiError(response.status, `BirdNET-Pi error ${response.status}`);
  }
  return response.json() as Promise<T>;
}

// ── HTML parsers ─────────────────────────────────────────────────────────────

/**
 * Parse detection rows from the HTML fragment returned by
 * /todays_detections.php?ajax_detections=true&display_limit=N
 *
 * Each <tr> contains:
 *   <td>{Time HH:MM:SS}</td>
 *   <td>{Common Name}</td>
 *   <td>{Scientific Name}</td>
 *   <td>{Confidence 0.87 or 87%}</td>
 *   <td>...<div class="custom-audio-player" data-audio-src="/By_Date/{Date}/{Com_Underscored}/{File_Name}">...</div></td>
 *
 * The audio path includes the date, so we derive timestamps from it.
 */
function parseDetectionRows(html: string, base: string): Detection[] {
  const detections: Detection[] = [];
  // Match each table row
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const row = rowMatch[1] ?? '';

    // Extract audio src — this also gives us the date
    const audioSrcMatch = row.match(/data-audio-src=['"]([^'"]+)['"]/);
    if (!audioSrcMatch) continue;
    const audioRelPath = audioSrcMatch[1] ?? '';
    if (!audioRelPath) continue;

    // Extract date from audio path: /By_Date/YYYY-MM-DD/...
    const pathParts = audioRelPath.split('/').filter(Boolean);
    // pathParts: ['By_Date', '2024-03-15', 'American_Robin', '2024-03-15-birdnet-14:23:05.mp3']
    const date = pathParts[1] ?? new Date().toISOString().slice(0, 10);

    // Extract td text content (strip inner HTML tags)
    const cells = Array.from(row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi))
      .map((m) => (m[1] ?? '').replace(/<[^>]+>/g, '').trim());

    if (cells.length < 4) continue;
    const time = cells[0] ?? '';
    const comName = cells[1] ?? '';
    const sciName = cells[2] ?? '';
    const confRaw = cells[3] ?? '0';
    // Confidence may be "0.87" or "87%" — normalise to 0–1
    const confNum = parseFloat(confRaw.replace('%', ''));
    const confidence = confNum > 1 ? confNum / 100 : confNum;

    const fileName = pathParts[pathParts.length - 1] ?? '';
    const id = `${date}_${time}_${fileName}`;

    detections.push({
      id,
      speciesId: sciName,
      commonName: comName,
      scientificName: sciName,
      timestamp: `${date}T${time}`,
      confidence: isNaN(confidence) ? 0 : confidence,
      soundscapeUrl: `${base}${audioRelPath}`,
      imageUrl: undefined, // filled in separately for Nachtzuster
    });
  }

  return detections;
}

/**
 * Parse the five headline stats from
 * /todays_detections.php?today_stats=true
 *
 * The HTML table columns (in order):
 *   Total | Today | Last Hour | Species Total | Species Today
 */
function parseStatsHtml(html: string): Stats {
  const numbers = Array.from(html.matchAll(/<td[^>]*>\s*(\d+)\s*<\/td>/gi))
    .map((m) => parseInt(m[1] ?? '0', 10));
  // [0] = Total detections, [1] = Today, [2] = Last Hour, [3] = Species Total, [4] = Species Today
  return {
    totalRecords: numbers[0] ?? 0,
    recordsToday: numbers[1] ?? 0,
    uniqueSpecies: numbers[3] ?? 0,
  };
}

/**
 * Parse species buttons from /play.php?byspecies=1 HTML.
 * Each species appears as a button or link with the common name as text
 * and ?species=... in the href. Scientific name is not directly in this view.
 * Returns { commonName } entries; caller fills sciName from detection history.
 */
function parseSpeciesListHtml(html: string): Pick<Species, 'commonName' | 'id'>[] {
  const results: Pick<Species, 'commonName' | 'id'>[] = [];
  const linkRegex = /href=['"][^'"]*\?species=([^'"&]+)['"]/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(html)) !== null) {
    const comName = decodeURIComponent((m[1] ?? '').replace(/\+/g, ' '));
    if (comName) {
      results.push({ id: comName, commonName: comName });
    }
  }
  // Deduplicate by commonName
  return results.filter(
    (s, i, arr) => arr.findIndex((x) => x.commonName === s.commonName) === i,
  );
}

// ── Nachtzuster detection ────────────────────────────────────────────────────

/**
 * Check whether this installation is the Nachtzuster fork, which adds a real
 * image API (/api/v1/image/{Sci_Name}) and a JSON labels endpoint.
 * Returns true if Nachtzuster, false if mcguirepr89 (or unknown).
 */
async function detectNachtzuster(base: string): Promise<boolean> {
  try {
    const r = await fetch(`${base}/api/v1/image/Turdus_migratorius`);
    // 200 or 404 both mean the endpoint exists (Nachtzuster); connection error means it doesn't
    return r.status === 200 || r.status === 404;
  } catch {
    return false;
  }
}

// ── Adapter factory ─────────────────────────────────────────────────────────

export function createBirdNetPiAdapter(hostUrl: string): StationAdapter {
  const base = hostUrl.replace(/\/$/, '');

  // Nachtzuster flag: resolved lazily on first species fetch, cached
  let isNachtzuster: boolean | null = null;
  async function getNachtzuster(): Promise<boolean> {
    if (isNachtzuster === null) {
      isNachtzuster = await detectNachtzuster(base);
    }
    return isNachtzuster;
  }

  return {
    cacheKey: `bnpi:${base}`,

    // ── Recent detections ────────────────────────────────────────────────────
    // BirdNET-Pi's todays_detections.php only shows today's detections.
    // Pagination: display_limit acts as a "load up to N" cap; we use it as cursor.
    async fetchRecentRecords(cursor?: string): Promise<RecordsPage> {
      const limit = 50;
      const displayLimit = cursor ? parseInt(cursor, 10) + limit : limit;
      const html = await bpiGetHtml(
        base,
        `/todays_detections.php?ajax_detections=true&display_limit=${displayLimit}`,
      );
      const all = parseDetectionRows(html, base);
      // The offset into all rows for this page
      const offset = cursor ? parseInt(cursor, 10) : 0;
      const page = all.slice(offset, offset + limit);
      const hasMore = all.length >= displayLimit;
      return {
        records: page,
        cursor: hasMore ? String(displayLimit) : undefined,
      };
    },

    // ── Single detection ─────────────────────────────────────────────────────
    // BirdNET-Pi has no single-record endpoint; scan today's list.
    async fetchRecord(id: string): Promise<Detection> {
      const html = await bpiGetHtml(
        base,
        `/todays_detections.php?ajax_detections=true&display_limit=500`,
      );
      const detections = parseDetectionRows(html, base);
      const found = detections.find((d) => d.id === id);
      if (!found) throw new Error(`Detection not found: ${id}`);
      return found;
    },

    // ── Per-species detections ────────────────────────────────────────────────
    // searchterm matches common name, sci name, confidence, filename, or time
    async fetchRecordsForSpecies(speciesId: string, limit = 20): Promise<Detection[]> {
      const html = await bpiGetHtml(
        base,
        `/todays_detections.php?ajax_detections=true&searchterm=${encodeURIComponent(speciesId)}&display_limit=${limit}`,
      );
      return parseDetectionRows(html, base);
    },

    // ── Species list ──────────────────────────────────────────────────────────
    async fetchTopSpecies(limit: number): Promise<Species[]> {
      const nachtzuster = await getNachtzuster();

      if (nachtzuster) {
        // Nachtzuster: /play.php?getlabels=true returns JSON ["Sci_Name_Common Name", ...]
        const labels = await bpiGetJson<string[]>(base, '/play.php?getlabels=true');
        const species: Species[] = [];
        for (const label of labels.slice(0, limit)) {
          const underscoreIdx = label.indexOf('_');
          if (underscoreIdx === -1) continue;
          species.push({
            id: label.slice(0, underscoreIdx),
            commonName: label.slice(underscoreIdx + 1),
            scientificName: label.slice(0, underscoreIdx),
            imageUrl: undefined,
            count: 0, // count not in labels list; would need stats endpoint
          });
        }
        return species;
      }

      // mcguirepr89: parse HTML from /play.php?byspecies=1
      const html = await bpiGetHtml(base, '/play.php?byspecies=1');
      const partials = parseSpeciesListHtml(html);
      return partials.slice(0, limit).map((p) => ({
        id: p.id,
        commonName: p.commonName,
        scientificName: p.id, // sci name not in this view; use common name as fallback
        imageUrl: undefined,
        count: 0,
      }));
    },

    // ── Single species ────────────────────────────────────────────────────────
    async fetchSpecies(id: string): Promise<Species> {
      const nachtzuster = await getNachtzuster();

      let imageUrl: string | undefined;
      if (nachtzuster) {
        try {
          const img = await bpiGetJson<{
            status: string;
            data?: { image_url?: string };
          }>(base, `/api/v1/image/${encodeURIComponent(id)}`);
          imageUrl = img.data?.image_url;
        } catch {
          // image not found — continue without it
        }
      }

      // Get detection count from the per-species search
      const html = await bpiGetHtml(
        base,
        `/todays_detections.php?ajax_detections=true&searchterm=${encodeURIComponent(id)}&display_limit=500`,
      );
      const detections = parseDetectionRows(html, base);
      const sample = detections[0];

      return {
        id,
        commonName: sample?.commonName ?? id,
        scientificName: sample?.scientificName ?? id,
        imageUrl,
        count: detections.length,
      };
    },

    // ── Stats ─────────────────────────────────────────────────────────────────
    async fetchStats(): Promise<Stats> {
      const html = await bpiGetHtml(base, '/todays_detections.php?today_stats=true');
      return parseStatsHtml(html);
    },

    // ── Daily detection counts ────────────────────────────────────────────────
    // BirdNET-Pi's daily-count endpoint is per-species (requires a comname param).
    // We can't easily get overall daily counts without querying each species.
    // Return today's single data point as a stub so the chart renders something.
    async fetchDailyCounts(days: number): Promise<{ date: string; count: number }[]> {
      try {
        const stats = await this.fetchStats();
        const today = new Date().toISOString().slice(0, 10);
        // Build a stub array of `days` entries, only today is populated
        return Array.from({ length: days }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (days - 1 - i));
          const dateStr = d.toISOString().slice(0, 10);
          return { date: dateStr, count: dateStr === today ? stats.recordsToday : 0 };
        });
      } catch {
        return [];
      }
    },
  };
}

// ── Liveness probe ───────────────────────────────────────────────────────────

/**
 * Verify a BirdNET-Pi host is reachable by fetching today's stats.
 * Returns undefined (BirdNET-Pi doesn't expose a station name by default).
 */
export async function pingBirdNetPi(hostUrl: string): Promise<string | undefined> {
  const base = hostUrl.replace(/\/$/, '');
  let response: Response;
  try {
    response = await fetch(`${base}/todays_detections.php?today_stats=true`);
  } catch {
    throw new Error(
      'Could not reach the BirdNET-Pi station — check the host URL and that your phone is on the same network.',
    );
  }
  if (!response.ok) {
    throw new Error(
      `BirdNET-Pi station responded with HTTP ${response.status}. Check the URL and try again.`,
    );
  }
  // Verify it looks like a BirdNET-Pi response (HTML containing detection stats)
  const body = await response.text();
  if (!body.includes('<td>') && !body.includes('detections')) {
    throw new Error(
      'The server responded but does not appear to be a BirdNET-Pi station. Check the URL.',
    );
  }
  return undefined;
}
