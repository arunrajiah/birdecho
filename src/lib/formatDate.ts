/**
 * Date formatting helpers.
 *
 * Always use the device's locale (undefined = system default) so numbers,
 * separators, and AM/PM match what the user expects. When a station timezone
 * is available, times are shown in the station's local time rather than the
 * device's timezone — important when the user's phone is in a different
 * region from their station.
 *
 * Formatters are made once per style and timezone and then reused: building an
 * Intl.DateTimeFormat is slow on Hermes, and the feed formats a time for every
 * card it draws while scrolling.
 */

type Style = 'time' | 'dateTime';

const STYLES: Record<Style, Intl.DateTimeFormatOptions> = {
  time: { hour: '2-digit', minute: '2-digit' },
  dateTime: { dateStyle: 'medium', timeStyle: 'short' },
};

const formatters = new Map<string, Intl.DateTimeFormat>();

/** The formatter for a style in the station's timezone, or the device's when the station's is missing or unknown. */
export function formatterFor(style: Style, timezone?: string): Intl.DateTimeFormat {
  const key = `${style}|${timezone ?? ''}`;
  let f = formatters.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(undefined, { ...STYLES[style], ...(timezone ? { timeZone: timezone } : {}) });
    } catch {
      // Intl throws for an unrecognised timezone: fall back to the device's.
      f = new Intl.DateTimeFormat(undefined, STYLES[style]);
    }
    formatters.set(key, f);
  }
  return f;
}

function format(style: Style, timestamp: string, timezone?: string): string {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return '—';
  return formatterFor(style, timezone).format(date);
}

/** "2:34 PM" — used in the feed card */
export function formatTime(timestamp: string, timezone?: string): string {
  return format('time', timestamp, timezone);
}

/** "Apr 27, 2026, 2:34 PM" — used in the sighting detail screen */
export function formatDateTime(timestamp: string, timezone?: string): string {
  return format('dateTime', timestamp, timezone);
}
