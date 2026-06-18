/**
 * Station-relative species rarity.
 *
 * BirdEcho has no access to regional or seasonal checklists (that would require
 * an external dataset such as eBird, which is out of scope), so "rare" here means
 * *rarely detected at this particular station* — a species whose detection count
 * is a small fraction of the station's most-detected species.
 *
 * This is intentionally conservative: it only fires on stations with enough
 * species to make a ranking meaningful, and only flags species detected far less
 * often than the station's most common bird.
 */

/** A species is rare if detected less than this fraction as often as the top species. */
export const RARITY_RATIO = 0.05;

/** Don't label rarity until the station has at least this many distinct species. */
export const MIN_SPECIES_FOR_RARITY = 5;

/**
 * @param count        detections of this species at the station
 * @param maxCount     detections of the station's most-detected species
 * @param speciesCount number of distinct species detected at the station
 */
export function isRareAtStation(
  count: number,
  maxCount: number,
  speciesCount: number,
): boolean {
  if (count <= 0) return false;
  if (maxCount <= 0) return false;
  if (speciesCount < MIN_SPECIES_FOR_RARITY) return false;
  return count / maxCount < RARITY_RATIO;
}
