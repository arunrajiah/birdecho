import type { StationAdapter } from '../adapter';
import type { Detection, RecordsPage, Species, Stats } from '../../types/birdweather';

/**
 * Demo adapter — serves bundled sample data so the app can be explored with no
 * station, account, token, or network. Used by the "Try a demo station" option
 * on the Connect screen. Timestamps are generated relative to the current time
 * so the feed and 14-day chart always look live.
 *
 * This exists both as a genuine "try before you connect" feature and so that
 * Google Play reviewers (who have no bird-detection station) can review the app.
 */

const SPECIES: Species[] = [
  { id: 'amerob', commonName: 'American Robin', scientificName: 'Turdus migratorius', count: 128 },
  { id: 'norcar', commonName: 'Northern Cardinal', scientificName: 'Cardinalis cardinalis', count: 96 },
  { id: 'blujay', commonName: 'Blue Jay', scientificName: 'Cyanocitta cristata', count: 74 },
  { id: 'houspa', commonName: 'House Sparrow', scientificName: 'Passer domesticus', count: 61 },
  { id: 'amegfi', commonName: 'American Goldfinch', scientificName: 'Spinus tristis', count: 53 },
  { id: 'bkcchi', commonName: 'Black-capped Chickadee', scientificName: 'Poecile atricapillus', count: 48 },
  { id: 'moudov', commonName: 'Mourning Dove', scientificName: 'Zenaida macroura', count: 40 },
  { id: 'sonspa', commonName: 'Song Sparrow', scientificName: 'Melospiza melodia', count: 33 },
  { id: 'dowwoo', commonName: 'Downy Woodpecker', scientificName: 'Dryobates pubescens', count: 27 },
  { id: 'houfin', commonName: 'House Finch', scientificName: 'Haemorhous mexicanus', count: 22 },
  { id: 'whbnut', commonName: 'White-breasted Nuthatch', scientificName: 'Sitta carolinensis', count: 18 },
  { id: 'tuftit', commonName: 'Tufted Titmouse', scientificName: 'Baeolophus bicolor', count: 14 },
];

const speciesById = (id: string): Species =>
  SPECIES.find((s) => s.id === id) ?? SPECIES[0]!;

/** Build a stable set of ~48 detections with timestamps relative to `now`. */
function buildDetections(): Detection[] {
  const now = Date.now();
  const out: Detection[] = [];
  for (let i = 0; i < 48; i++) {
    // Denser in the recent past, spreading back to ~13 days.
    const minutesAgo = Math.round(i * i * 11 + i * 6 + 2);
    const sp = SPECIES[(i * 7) % SPECIES.length]!;
    out.push({
      id: `demo-${i}`,
      speciesId: sp.id,
      commonName: sp.commonName,
      scientificName: sp.scientificName,
      timestamp: new Date(now - minutesAgo * 60_000).toISOString(),
      confidence: 0.7 + ((i * 37) % 30) / 100,
    });
  }
  return out;
}

function isSameDay(iso: string, ref: number): boolean {
  const d = new Date(iso);
  const r = new Date(ref);
  return (
    d.getFullYear() === r.getFullYear() &&
    d.getMonth() === r.getMonth() &&
    d.getDate() === r.getDate()
  );
}

export function createDemoAdapter(): StationAdapter {
  const detections = buildDetections();

  return {
    cacheKey: 'demo',

    fetchRecentRecords: async (): Promise<RecordsPage> => ({
      records: detections,
      cursor: undefined,
    }),

    fetchRecord: async (id: string): Promise<Detection> =>
      detections.find((d) => d.id === id) ?? detections[0]!,

    fetchRecordsForSpecies: async (speciesId: string, limit = 20): Promise<Detection[]> =>
      detections.filter((d) => d.speciesId === speciesId).slice(0, limit),

    fetchTopSpecies: async (limit: number): Promise<Species[]> =>
      [...SPECIES].sort((a, b) => b.count - a.count).slice(0, limit),

    fetchSpecies: async (id: string): Promise<Species> => speciesById(id),

    fetchStats: async (): Promise<Stats> => {
      const now = Date.now();
      return {
        totalRecords: SPECIES.reduce((sum, s) => sum + s.count, 0),
        uniqueSpecies: SPECIES.length,
        recordsToday: detections.filter((d) => isSameDay(d.timestamp, now)).length,
      };
    },

    fetchDailyCounts: async (days: number): Promise<{ date: string; count: number }[]> => {
      const now = Date.now();
      const out: { date: string; count: number }[] = [];
      for (let d = days - 1; d >= 0; d--) {
        const day = new Date(now - d * 86_400_000);
        const date = day.toISOString().slice(0, 10);
        // Deterministic, non-zero counts so the chart always reads well.
        out.push({ date, count: 6 + ((d * 13 + 5) % 16) });
      }
      return out;
    },
  };
}
