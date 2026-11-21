import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAUSE_FOREVER,
  fetchDeviceSettings,
  isPaused,
  pauseError,
  pauseLabel,
  pauseRequest,
  pauseUntil,
  sendAlertPause,
  stationPageUrl,
  stationSlug,
} from '../src/lib/baseAlerts';

const now = new Date('2026-11-21T10:00:00.000Z');

const answer = (status: number, body: unknown): typeof fetch =>
  (async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as typeof fetch;

describe('pauseUntil', () => {
  it('turns each choice into an ISO time, or null to resume', () => {
    assert.equal(pauseUntil('day', now), '2026-11-22T10:00:00.000Z');
    assert.equal(pauseUntil('week', now), '2026-11-28T10:00:00.000Z');
    assert.equal(pauseUntil('month', now), '2026-12-21T10:00:00.000Z');
    assert.equal(pauseUntil('forever', now), '2099-01-01T00:00:00Z');
    assert.equal(pauseUntil('resume', now), null);
  });
});

describe('pauseRequest', () => {
  it('posts the pause to the device settings with the device key', () => {
    const { url, init } = pauseRequest('dev/1', 'k', PAUSE_FOREVER);
    assert.equal(url, 'https://wlnw.org/api/v1/devices/dev%2F1/settings');
    assert.equal(init.method, 'POST');
    assert.equal((init.headers as Record<string, string>).authorization, 'Bearer k');
    assert.deepEqual(JSON.parse(String(init.body)), { alertsPausedUntil: '2099-01-01T00:00:00Z' });
  });
  it('sends null to turn alerts back on', () => {
    assert.deepEqual(JSON.parse(String(pauseRequest('d', 'k', null).init.body)), { alertsPausedUntil: null });
  });
});

describe('pause state', () => {
  it('is paused only for a time still ahead', () => {
    assert.equal(isPaused('2026-11-22T10:00:00Z', now), true);
    assert.equal(isPaused('2026-11-20T10:00:00Z', now), false);
    assert.equal(isPaused(null, now), false);
    assert.equal(isPaused(undefined, now), false);
    assert.equal(isPaused('nonsense', now), false);
  });
  it('labels on, open-ended and timed pauses', () => {
    assert.match(pauseLabel(null, now), /^Alerts are on/);
    assert.equal(pauseLabel(PAUSE_FOREVER, now), 'Alerts are paused until you turn them back on.');
    assert.match(pauseLabel('2026-11-28T10:00:00Z', now), /^Alerts are paused until .+\.$/);
  });
});

describe('pauseError', () => {
  it('explains each kind of failure in plain words', () => {
    assert.match(pauseError(null), /needs internet/);
    assert.match(pauseError(401), /did not accept/);
    assert.match(pauseError(403), /did not accept/);
    assert.equal(pauseError(404), 'Not available yet, try again later.');
    assert.equal(pauseError(400), 'Not available yet, try again later.');
    assert.match(pauseError(500), /could not save/);
  });
});

describe('sendAlertPause', () => {
  it('returns the time the server saved', async () => {
    const r = await sendAlertPause('d', 'k', PAUSE_FOREVER, answer(200, { test: false, alertsPausedUntil: '2099-01-01T00:00:00.000Z' }));
    assert.deepEqual(r, { ok: true, until: '2099-01-01T00:00:00.000Z' });
  });
  it('returns null after resuming', async () => {
    assert.deepEqual(await sendAlertPause('d', 'k', null, answer(200, { test: false, alertsPausedUntil: null })), { ok: true, until: null });
  });
  it('says it needs internet when the request never leaves the phone', async () => {
    const offline = (async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch;
    const r = await sendAlertPause('d', 'k', null, offline);
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.status, null);
  });
  it('maps refusals', async () => {
    const r401 = await sendAlertPause('d', 'k', null, answer(401, { error: 'unauthorized' }));
    assert.equal(!r401.ok && r401.error, pauseError(401));
    const r400 = await sendAlertPause('d', 'k', null, answer(400, { error: 'send test' }));
    assert.equal(!r400.ok && r400.error, 'Not available yet, try again later.');
  });
  it('treats a 200 without the field (older server) as not available', async () => {
    const r = await sendAlertPause('d', 'k', null, answer(200, { test: false }));
    assert.equal(!r.ok && r.error, 'Not available yet, try again later.');
  });
});

describe('fetchDeviceSettings', () => {
  it('reads test mode and the pause', async () => {
    assert.deepEqual(await fetchDeviceSettings('d', 'k', answer(200, { test: true, alertsPausedUntil: null })), {
      test: true,
      alertsPausedUntil: null,
    });
  });
  it('leaves the pause undefined on a server that does not know it', async () => {
    assert.deepEqual(await fetchDeviceSettings('d', 'k', answer(200, { test: false })), { test: false, alertsPausedUntil: undefined });
  });
  it('is null on failure', async () => {
    assert.equal(await fetchDeviceSettings('d', 'k', answer(404, {})), null);
  });
});

describe('stationSlug', () => {
  it('replaces the first colon with ~ and percent-encodes the id part', () => {
    assert.equal(stationSlug('wildnetwork-base:29ab78f229b9'), 'wildnetwork-base~29ab78f229b9');
    assert.equal(stationSlug('birdnet-go:a b:c'), 'birdnet-go~a%20b%3Ac');
    assert.equal(stationPageUrl('wildnetwork-base:29ab78f229b9'), 'https://wlnw.org/stations/wildnetwork-base~29ab78f229b9');
  });
  it('is null without a source or id', () => {
    assert.equal(stationSlug('nocolon'), null);
    assert.equal(stationSlug(':x'), null);
    assert.equal(stationSlug('x:'), null);
    assert.equal(stationPageUrl('nocolon'), null);
  });
});
