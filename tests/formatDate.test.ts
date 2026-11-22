import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatDateTime, formatTime, formatterFor } from '../src/lib/formatDate';

describe('formatDate', () => {
  const ts = '2026-04-27T14:34:00Z';

  it('formats in the station timezone, same as a fresh formatter', () => {
    const want = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(ts));
    assert.equal(formatTime(ts, 'Asia/Kolkata'), want);
    const wantFull = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(ts));
    assert.equal(formatDateTime(ts, 'UTC'), wantFull);
  });

  it('reuses one formatter per style and timezone', () => {
    assert.equal(formatterFor('time', 'Europe/Berlin'), formatterFor('time', 'Europe/Berlin'));
    assert.notEqual(formatterFor('time', 'Europe/Berlin'), formatterFor('dateTime', 'Europe/Berlin'));
  });

  it("falls back to the device's timezone for an unknown one", () => {
    const want = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
    assert.equal(formatTime(ts, 'Not/AZone'), want);
    assert.equal(formatTime(ts), want);
  });

  it('shows a dash for a bad timestamp', () => {
    assert.equal(formatTime('nonsense'), '—');
  });
});
