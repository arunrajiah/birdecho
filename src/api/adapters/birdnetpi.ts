/**
 * BirdNET-Pi direct HTTP adapter.
 *
 * BirdNET-Pi runs a Caddy + PHP web server; detections are stored in SQLite.
 * Unlike BirdNET-Go there is no JSON REST API: the endpoints return HTML
 * fragments, which we parse. Every parser here is checked against the real PHP
 * output of both supported forks (recorded in tests/fixtures, run `pnpm test`):
 *   - mcguirepr89/BirdNET-Pi   (original)
 *   - Nachtzuster/BirdNET-Pi   (maintained fork; adds /api/v1/image/{Sci_Name})
 *
 * Auth: HTTP Basic Auth is required only for admin/write paths (/scripts/*,
 * /stream, /Processed/*, etc.). All read endpoints used here are public.
 *
 * @see https://github.com/mcguirepr89/BirdNET-Pi
 * @see https://github.com/Nachtzuster/BirdNET-Pi
 */

import { ApiError } from '../../lib/apiClient';
import { USER_AGENT } from '../../lib/remoteImage';
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
  // Caddy falls back to index.php for unknown paths, so a fork without this
  // endpoint answers 200 with the HTML dashboard. Never parse that as JSON.
  const ct = response.headers.get('content-type') ?? '';
  if (!ct.includes('json')) {
    throw new ApiError(response.status, 'BirdNET-Pi returned a non-JSON response');
  }
  return response.json() as Promise<T>;
}

// ── HTML helpers ─────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#039;': "'",
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

function decodeEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#0?39);/g, (m) => ENTITIES[m] ?? m);
}

/** Visible text of an HTML fragment: tags dropped, entities decoded, whitespace collapsed. */
function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** Local calendar date as YYYY-MM-DD (the station reports local dates, not UTC). */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const AUDIO_PATH_RE =
  /=\s*["']([^"']*\/By_Date\/[^"']+?\.(?:mp3|wav|flac|ogg|opus|m4a|aac))["']/i;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ── HTML parsers ─────────────────────────────────────────────────────────────

/**
 * Parse detection rows from the HTML fragment returned by
 * /todays_detections.php?ajax_detections=true&display_limit=N
 *
 * Each row is one <tr> holding the time, the common name (element with
 * class="a2"), the scientific name (<i>), "Confidence: NN%" and an audio
 * player. The forks differ in the details, so fields are located by what they
 * are rather than by column position:
 *   - rows are NOT closed individually; the template emits one </tr> after the
 *     whole loop, so we split on <tr> openings
 *   - audio is a data-audio-src attribute (Nachtzuster), a <video><source src>
 *     (mcguirepr89) or an <audio src> (legacy layout)
 * A row without a recognisable audio player is still a detection; it just has
 * no soundscapeUrl.
 */
export function parseDetectionRows(html: string, base: string): Detection[] {
  const detections: Detection[] = [];
  const rows = html.split(/<tr\b[^>]*>/i).slice(1);

  for (const row of rows) {
    const comName = textOf(
      row.match(/<(a|button)\b[^>]*class=["']a2["'][^>]*>([\s\S]*?)<\/\1>/i)?.[2] ?? '',
    );
    const sciName = textOf(row.match(/<i\b[^>]*>([\s\S]*?)<\/i>/i)?.[1] ?? '');
    const text = textOf(row);
    const timeMatch = text.match(/\b(\d{1,2}):(\d{2}):(\d{2})\b/);

    // Skip header/summary rows that aren't real detections.
    if (!timeMatch || !comName) continue;
    const time = `${timeMatch[1]!.padStart(2, '0')}:${timeMatch[2]}:${timeMatch[3]}`;

    // Anchor on the label first: image onclick attributes carry URL-encoded
    // text (%2C...) that would otherwise be read as a percentage.
    const confRaw =
      row.match(/Confidence:?\s*(?:<\/b>)?\s*(\d{1,3}(?:\.\d+)?)\s*%/i)?.[1] ??
      text.match(/(\d{1,3}(?:\.\d+)?)\s*%/)?.[1] ??
      '0';
    const confNum = parseFloat(confRaw);
    const confidence = isNaN(confNum) ? 0 : Math.min(confNum / 100, 1);

    const audioRelPath = row.match(AUDIO_PATH_RE)?.[1];
    const pathParts = (audioRelPath ?? '').split('/').filter(Boolean);
    // /By_Date/YYYY-MM-DD/Species/file.mp3, but scan for the date segment
    // rather than trusting its position.
    const date = pathParts.find((p) => ISO_DATE_RE.test(p)) ?? ymd(new Date());
    const fileName = pathParts[pathParts.length - 1] ?? comName.replace(/\s+/g, '_');

    detections.push({
      id: `${date}_${time}_${fileName}`,
      speciesId: sciName || comName,
      commonName: comName,
      scientificName: sciName,
      timestamp: `${date}T${time}`,
      confidence,
      soundscapeUrl: audioRelPath ? `${base}${encodeURI(audioRelPath)}` : undefined,
      imageUrl: undefined,
    });
  }

  return detections;
}

/**
 * True when the station sent detection rows but none could be read. That is a
 * parser/format mismatch, not an empty day, and must not be shown as
 * "no sightings yet".
 */
function looksUnparsed(html: string, parsed: Detection[]): boolean {
  return parsed.length === 0 && /<tr\b/i.test(html) && /\d{1,2}:\d{2}:\d{2}/.test(textOf(html));
}

const UNPARSED_MESSAGE =
  'BirdEcho could not read the detection list from this BirdNET-Pi station. ' +
  'Please report this at github.com/arunrajiah/birdecho/issues with your BirdNET-Pi version.';

/**
 * Parse the five headline stats from
 * /todays_detections.php?today_stats=true
 *
 * The HTML table columns (in order):
 *   Total | Today | Last Hour | Species Total | Species Today
 *
 * Values may be wrapped in inner elements (<button>, <form>), so inner tags
 * are stripped before parsing.
 */
export function parseStatsHtml(html: string): Stats {
  const numbers = Array.from(html.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi))
    .map((m) => textOf(m[1] ?? ''))
    .filter((text) => /^\d+$/.test(text))
    .map((text) => parseInt(text, 10));
  // [0] = Total detections, [1] = Today, [2] = Last Hour, [3] = Species Total, [4] = Species Today
  return {
    totalRecords: numbers[0] ?? 0,
    recordsToday: numbers[1] ?? 0,
    uniqueSpecies: numbers[3] ?? 0,
  };
}

export interface SpeciesButton {
  /** Form value: scientific name on Nachtzuster, common name on mcguirepr89. */
  value: string;
  commonName: string;
  /** Present only when the page was requested with sort=occurrences on Nachtzuster. */
  count?: number;
  /** True when the label rounded the count ("13.6k"). */
  approximate?: boolean;
}

/**
 * Parse the species buttons of /play.php (byspecies or date view):
 *   <button type="submit" name="species" value="Turdus migratorius">American Robin (95)</button>
 * The "(95)" suffix is the detection count ("(1.2k)" from 1000 up) and only
 * Nachtzuster prints it; mcguirepr89 prints the bare name.
 */
export function parseSpeciesButtons(html: string): SpeciesButton[] {
  const out: SpeciesButton[] = [];
  const seen = new Set<string>();
  const re = /<button\b[^>]*\bname=["']species["'][^>]*>([\s\S]*?)<\/button>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0].slice(0, m[0].indexOf('>') + 1);
    const value = decodeEntities(
      tag.match(/\bvalue="([^"]*)"/i)?.[1] ?? tag.match(/\bvalue='([^']*)'/i)?.[1] ?? '',
    ).trim();
    const label = textOf(m[1] ?? '');
    if (!value || !label || seen.has(value)) continue;
    seen.add(value);
    const counted = label.match(/^(.*\S)\s*\((\d+(?:\.\d+)?)(k?)\)$/i);
    if (counted) {
      const n = parseFloat(counted[2]!) * (counted[3] ? 1000 : 1);
      out.push({ value, commonName: counted[1]!, count: Math.round(n), approximate: !!counted[3] });
    } else {
      out.push({ value, commonName: label });
    }
  }
  return out;
}

/**
 * All-time detections per species from /stats.php. mcguirepr89's play.php
 * species buttons carry no counts, but its stats page prints each species
 * button followed by `<b>Occurrences:</b> N`.
 */
export function parseOccurrences(html: string): Map<string, number> {
  const out = new Map<string, number>();
  const re =
    /<button\b[^>]*\bname=["']species["'][^>]*\bvalue=(?:"([^"]*)"|'([^']*)')[^>]*>[\s\S]*?<\/button>\s*(?:<br\s*\/?>\s*)?<b>\s*Occurrences:\s*<\/b>\s*([\d,]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const name = decodeEntities(m[1] ?? m[2] ?? '').trim();
    if (name && !out.has(name)) out.set(name, parseInt(m[3]!.replace(/,/g, ''), 10));
  }
  return out;
}

// ── Pagination helper ────────────────────────────────────────────────────────

const PAGE_SIZE = 40;

/**
 * `todays_detections.php?ajax_detections=true&display_limit=N` is NOT "return
 * up to N rows". The server always runs `LIMIT (display_limit-40),40`, so
 * `display_limit` is a running cursor that must climb in steps of exactly 40
 * (40, 80, 120, ...), matching the site's own "Load 40 More" button.
 */
async function fetchTodaysPage(
  base: string,
  displayLimit: number,
  searchterm?: string,
): Promise<Detection[]> {
  const query = searchterm ? `&searchterm=${encodeURIComponent(searchterm)}` : '';
  const html = await bpiGetHtml(
    base,
    `/todays_detections.php?ajax_detections=true${query}&display_limit=${displayLimit}`,
  );
  const page = parseDetectionRows(html, base);
  if (looksUnparsed(html, page)) throw new Error(UNPARSED_MESSAGE);
  return page;
}

/**
 * Walk today's detections page by page, stopping at the end of data, at
 * `maxRows`, or as soon as `until` matches a row.
 */
async function fetchAllTodaysDetections(
  base: string,
  searchterm?: string,
  maxRows = 500,
  until?: (d: Detection) => boolean,
): Promise<Detection[]> {
  const all: Detection[] = [];
  let displayLimit = PAGE_SIZE;
  for (;;) {
    const page = await fetchTodaysPage(base, displayLimit, searchterm);
    all.push(...page);
    if (page.length < PAGE_SIZE || all.length >= maxRows) break;
    if (until && page.some(until)) break;
    displayLimit += PAGE_SIZE;
  }
  return all;
}

// ── Images ───────────────────────────────────────────────────────────────────

const WIKIMEDIA_HOST_RE = /^https?:\/\/[^/]*\.wikimedia\.org\//i;

/** Wikipedia's 330px lead image for a scientific name (the full original can be many MB). */
async function wikipediaThumbnail(scientificName: string): Promise<string | undefined> {
  const title = encodeURIComponent(scientificName.trim().replace(/\s+/g, '_'));
  try {
    const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!response.ok) return undefined;
    const data = (await response.json()) as { thumbnail?: { source?: string } };
    return data.thumbnail?.source || undefined;
  } catch {
    return undefined;
  }
}

/** Run `fn` over `items` with at most `limit` in flight. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// ── Adapter factory ─────────────────────────────────────────────────────────

export function createBirdNetPiAdapter(hostUrl: string): StationAdapter {
  const base = hostUrl.replace(/\/$/, '');

  /**
   * Every species the station has ever detected, most detected first, from
   * /play.php?byspecies=1&sort=occurrences. Today's detections fill in what
   * that page lacks on mcguirepr89 (scientific names, counts).
   */
  async function loadSpeciesList(): Promise<Species[]> {
    const [listResult, todayResult] = await Promise.allSettled([
      bpiGetHtml(base, '/play.php?byspecies=1&sort=occurrences').then(parseSpeciesButtons),
      fetchAllTodaysDetections(base),
    ]);
    const buttons = listResult.status === 'fulfilled' ? listResult.value : [];
    for (const b of buttons) if (b.approximate) approximate.add(b.commonName);

    // mcguirepr89: the buttons have no counts, so read all-time totals from stats.php.
    if (buttons.length > 0 && buttons.every((b) => b.count === undefined)) {
      try {
        const totals = parseOccurrences(await bpiGetHtml(base, '/stats.php'));
        for (const b of buttons) b.count = totals.get(b.commonName) ?? totals.get(b.value);
      } catch {
        // Older or customised stations without stats.php keep the fallback below.
      }
    }
    const today = todayResult.status === 'fulfilled' ? todayResult.value : [];
    if (listResult.status === 'rejected' && todayResult.status === 'rejected') {
      throw todayResult.reason;
    }

    const todayByCommon = new Map<string, { scientificName: string; count: number }>();
    for (const d of today) {
      const entry = todayByCommon.get(d.commonName);
      if (entry) entry.count += 1;
      else todayByCommon.set(d.commonName, { scientificName: d.scientificName, count: 1 });
    }

    const species: Species[] = buttons.map((b) => {
      const seenToday = todayByCommon.get(b.commonName);
      // The button value is the scientific name on Nachtzuster and the common
      // name on mcguirepr89; only trust it as scientific when it differs.
      const scientificName =
        b.value !== b.commonName ? b.value : (seenToday?.scientificName ?? '');
      return {
        id: scientificName || b.commonName,
        commonName: b.commonName,
        scientificName,
        imageUrl: undefined,
        count: b.count ?? seenToday?.count ?? 0,
      };
    });

    // Species page unavailable or unreadable: fall back to what was heard today.
    if (species.length === 0) {
      for (const [commonName, v] of todayByCommon) {
        species.push({
          id: v.scientificName || commonName,
          commonName,
          scientificName: v.scientificName,
          imageUrl: undefined,
          count: v.count,
        });
      }
    }

    // Stable sort: keeps the server's all-time order where counts are unknown.
    const counted = buttons.some((b) => b.count !== undefined) || buttons.length === 0;
    return counted ? species.sort((a, b) => b.count - a.count) : species;
  }

  const approximate = new Set<string>();

  // The species list backs the Species tab, every species page and every
  // favourite row, so share one load between callers that arrive together.
  let speciesListCache: { at: number; list: Promise<Species[]> } | null = null;
  function fetchSpeciesList(): Promise<Species[]> {
    const now = Date.now();
    if (!speciesListCache || now - speciesListCache.at > 30_000) {
      const list = loadSpeciesList();
      speciesListCache = { at: now, list };
      list.catch(() => {
        if (speciesListCache?.list === list) speciesListCache = null;
      });
    }
    return speciesListCache.list;
  }

  /**
   * Picture for a species. Nachtzuster's /api/v1/image returns the station's
   * configured provider: a Flickr URL is used as is, but its Wikipedia answer
   * is the full-size original, so Wikipedia's thumbnail is used instead. That
   * thumbnail is also the fallback for mcguirepr89, which has no image API.
   */
  const imageCache = new Map<string, Promise<string | undefined>>();
  function fetchImageUrl(scientificName: string, commonName = ''): Promise<string | undefined> {
    // mcguirepr89 only names species by common name unless they were heard
    // today; Wikipedia resolves either.
    if (!scientificName) {
      return commonName ? wikipediaThumbnail(commonName) : Promise.resolve(undefined);
    }
    let cached = imageCache.get(scientificName);
    if (!cached) {
      cached = (async () => {
        try {
          const img = await bpiGetJson<{ data?: { image_url?: string } }>(
            base,
            `/api/v1/image/${encodeURIComponent(scientificName)}`,
          );
          const url = img.data?.image_url;
          if (url && !WIKIMEDIA_HOST_RE.test(url)) return url;
        } catch {
          // mcguirepr89, or no image for this species on the station
        }
        return wikipediaThumbnail(scientificName);
      })();
      imageCache.set(scientificName, cached);
    }
    return cached;
  }

  async function withImages<
    T extends { scientificName: string; commonName: string; imageUrl?: string },
  >(items: T[]): Promise<T[]> {
    const key = (i: T) => i.scientificName || i.commonName;
    const unique = [...new Map(items.map((i) => [key(i), i])).values()];
    const urls = await mapLimit(unique, 6, (i) => fetchImageUrl(i.scientificName, i.commonName));
    const byKey = new Map(unique.map((i, n) => [key(i), urls[n]]));
    return items.map((i) => ({ ...i, imageUrl: i.imageUrl ?? byKey.get(key(i)) }));
  }

  /**
   * Exact all-time count for a species (Nachtzuster). The species page prints
   * "(13.6k)" from 1000 up; the per-day chart endpoint has exact numbers, and
   * `days` far in the past covers every day the station has recorded.
   */
  async function exactCount(commonName: string): Promise<number | undefined> {
    try {
      const text = await bpiGetHtml(
        base,
        `/todays_detections.php?comname=${encodeURIComponent(commonName)}&days=36500`,
      );
      const days = JSON.parse(text) as { count?: number | string }[];
      if (!Array.isArray(days)) return undefined;
      return days.reduce((n, d) => n + (Number(d.count) || 0), 0);
    } catch {
      return undefined;
    }
  }

  async function withExactCounts(list: Species[]): Promise<Species[]> {
    const counts = await mapLimit(list, 4, (sp) =>
      approximate.has(sp.commonName) ? exactCount(sp.commonName) : Promise.resolve(undefined),
    );
    return list.map((sp, i) => {
      const exact = counts[i];
      return exact && exact > 0 ? { ...sp, count: exact } : sp;
    });
  }

  return {
    cacheKey: `bnpi:${base}`,

    // ── Recent detections ────────────────────────────────────────────────────
    // todays_detections.php only shows today's detections, one 40-row window
    // per request. The cursor is the display_limit we just used.
    async fetchRecentRecords(cursor?: string): Promise<RecordsPage> {
      const displayLimit = cursor ? parseInt(cursor, 10) + PAGE_SIZE : PAGE_SIZE;
      const page = await withImages(await fetchTodaysPage(base, displayLimit));
      return {
        records: page,
        cursor: page.length >= PAGE_SIZE ? String(displayLimit) : undefined,
      };
    },

    // ── Single detection ─────────────────────────────────────────────────────
    // BirdNET-Pi has no single-record endpoint. The id embeds the time, which
    // the search matches, so this is normally a single one-row request.
    async fetchRecord(id: string): Promise<Detection> {
      const time = id.match(/_(\d{2}:\d{2}:\d{2})_/)?.[1];
      if (time) {
        try {
          const hit = (await fetchTodaysPage(base, PAGE_SIZE, time)).find((d) => d.id === id);
          if (hit) return (await withImages([hit]))[0]!;
        } catch {
          // fall through to the full scan
        }
      }
      const detections = await fetchAllTodaysDetections(base, undefined, 2000, (d) => d.id === id);
      const found = detections.find((d) => d.id === id);
      if (!found) {
        throw new Error('This detection is no longer in today\'s list on the station.');
      }
      return (await withImages([found]))[0]!;
    },

    // ── Per-species detections ────────────────────────────────────────────────
    // searchterm matches common name, sci name, confidence, filename, or time
    async fetchRecordsForSpecies(speciesId: string, limit = 20): Promise<Detection[]> {
      const detections = await fetchAllTodaysDetections(base, speciesId, Math.max(limit, 40));
      return withImages(
        detections
          .filter((d) => d.scientificName === speciesId || d.commonName === speciesId)
          .slice(0, limit),
      );
    },

    // ── Species list ──────────────────────────────────────────────────────────
    async fetchTopSpecies(limit: number): Promise<Species[]> {
      // Short lists (Stats' top 10) get exact counts; the full Species tab
      // keeps the station's rounded ones rather than a request per species.
      const top = (await fetchSpeciesList()).slice(0, limit);
      return withImages(limit <= 20 ? await withExactCounts(top) : top);
    },

    // ── Single species ────────────────────────────────────────────────────────
    async fetchSpecies(id: string): Promise<Species> {
      const list = await fetchSpeciesList();
      const match = list.find((s) => s.id === id || s.scientificName === id || s.commonName === id);
      const species: Species = match ?? {
        id,
        commonName: id,
        scientificName: '',
        imageUrl: undefined,
        count: 0,
      };
      const [withCount] = await withExactCounts([species]);
      return {
        ...withCount!,
        imageUrl: await fetchImageUrl(species.scientificName, species.commonName),
      };
    },

    // ── Stats ─────────────────────────────────────────────────────────────────
    async fetchStats(): Promise<Stats> {
      const html = await bpiGetHtml(base, '/todays_detections.php?today_stats=true');
      const stats = parseStatsHtml(html);

      // Some BirdNET-Pi versions omit or differently format the species columns.
      // Fall back to counting species from the species-list page.
      if (stats.uniqueSpecies === 0 && stats.totalRecords > 0) {
        try {
          const speciesHtml = await bpiGetHtml(base, '/play.php?byspecies=1');
          const speciesList = parseSpeciesButtons(speciesHtml);
          if (speciesList.length > 0) {
            stats.uniqueSpecies = speciesList.length;
          }
        } catch {
          // Best-effort — leave as 0 rather than crashing stats
        }
      }

      return stats;
    },

    // ── Daily detection counts ────────────────────────────────────────────────
    // There is no daily-totals endpoint. Today comes from the stats table. On
    // Nachtzuster, past days come from the per-date species page, whose labels
    // carry counts; mcguirepr89 prints no counts, so its past days stay empty.
    async fetchDailyCounts(days: number): Promise<{ date: string; count: number }[]> {
      const today = ymd(new Date());
      const dates = Array.from({ length: days }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (days - 1 - i));
        return ymd(d);
      });
      const counts = await Promise.all(
        dates.map(async (date) => {
          try {
            if (date === today) return (await this.fetchStats()).recordsToday;
            const html = await bpiGetHtml(base, `/play.php?date=${date}&sort=occurrences`);
            return parseSpeciesButtons(html).reduce((n, b) => n + (b.count ?? 0), 0);
          } catch {
            return 0;
          }
        }),
      );
      return dates.map((date, i) => ({ date, count: counts[i] ?? 0 }));
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
