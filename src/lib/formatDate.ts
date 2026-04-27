/**
 * Date formatting helpers.
 *
 * Always use the device's locale (undefined = system default) so numbers,
 * separators, and AM/PM match what the user expects. When a station timezone
 * is available, times are shown in the station's local time rather than the
 * device's timezone — important when the user's phone is in a different
 * region from their station.
 */

type TzOptions = { timeZone?: string };

function tz(timezone: string | undefined): TzOptions {
  try {
    if (timezone) {
      // Validate the timezone string — Intl throws if it's invalid
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return { timeZone: timezone };
    }
  } catch {
    // Fall back to device timezone if the station's value is unrecognised
  }
  return {};
}

/** "2:34 PM" — used in the feed card */
export function formatTime(timestamp: string, timezone?: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    ...tz(timezone),
  }).format(new Date(timestamp));
}

/** "Apr 27, 2026, 2:34 PM" — used in the sighting detail screen */
export function formatDateTime(timestamp: string, timezone?: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...tz(timezone),
  }).format(new Date(timestamp));
}
