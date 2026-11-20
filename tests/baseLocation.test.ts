import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BaseError } from '../src/lib/baseApi';
import {
  LOCATION_CHANGE_NOTE,
  buildLocationRequest,
  formatLocation,
  locationErrorMessage,
  parseLocation,
  phoneLocationResult,
  pickSetupCode,
} from '../src/lib/baseLocation';

describe('Base location input', () => {
  it('accepts coordinates in range and rounds them to about 1 km', () => {
    assert.deepEqual(parseLocation('13.08271', '80.27069'), { ok: true, value: { latitude: 13.08, longitude: 80.27 } });
    assert.deepEqual(parseLocation(' -33,8688 ', '151.2093'), { ok: true, value: { latitude: -33.87, longitude: 151.21 } });
    assert.deepEqual(parseLocation('90', '-180'), { ok: true, value: { latitude: 90, longitude: -180 } });
  });

  it('rejects empty, non-numeric and out of range values', () => {
    for (const [lat, lon] of [['', '80'], ['13', ' '], ['abc', '80'], ['13', '80e1'], ['1.2.3', '4'], ['Infinity', '0']]) {
      assert.equal(parseLocation(lat!, lon!).ok, false, `${lat}, ${lon}`);
    }
    const lat = parseLocation('90.5', '0');
    assert.equal(lat.ok, false);
    assert.match(lat.ok ? '' : lat.error, /Latitude must be between -90 and 90/);
    const lon = parseLocation('0', '-180.01');
    assert.match(lon.ok ? '' : lon.error, /Longitude must be between -180 and 180/);
  });
});

describe('Setup code for a location change', () => {
  it('uses the saved code when none is typed, and a typed code over the saved one', () => {
    assert.deepEqual(pickSetupCode('ABCDEFGH', ''), { ok: true, value: 'ABCDEFGH' });
    assert.deepEqual(pickSetupCode('ABCDEFGH', 'wxyz 2345'), { ok: true, value: 'WXYZ2345' });
  });

  it('asks for the code when none is saved, and rejects a malformed one', () => {
    assert.equal(pickSetupCode(undefined, '').ok, false);
    assert.equal(pickSetupCode('', '  ').ok, false);
    assert.equal(pickSetupCode('ABCDEFGH', 'ABC').ok, false);
  });
});

describe('Location request', () => {
  it('sends only latitude and longitude with the setup code', () => {
    assert.deepEqual(buildLocationRequest('51.5074', '-0.1278', 'ABCDEFGH', ''), {
      ok: true,
      value: { code: 'ABCDEFGH', config: { latitude: 51.51, longitude: -0.13 } },
    });
  });

  it('reports the location problem before the code problem', () => {
    const r = buildLocationRequest('100', '0', undefined, '');
    assert.match(r.ok ? '' : r.error, /Latitude/);
    const c = buildLocationRequest('10', '0', undefined, '');
    assert.match(c.ok ? '' : c.error, /setup code/);
  });
});

describe('Location change messages', () => {
  it('asks for the code again after a wrong code', () => {
    const r = locationErrorMessage(new BaseError('x', 403));
    assert.equal(r.askForCode, true);
    assert.match(r.message, /setup code is not right/);
  });

  it('says how to reach the Base when it cannot be reached', () => {
    const r = locationErrorMessage(new BaseError('x', 0));
    assert.equal(r.askForCode, false);
    assert.match(r.message, /Base’s Wi-Fi or the same Wi-Fi as the Base/);
  });

  it('passes other Base errors through', () => {
    assert.equal(locationErrorMessage(new BaseError('Bad values', 400)).message, 'Bad values');
    assert.equal(locationErrorMessage('boom').message, 'Something went wrong.');
  });

  it('formats the current location', () => {
    assert.equal(formatLocation(13.08, 80.27), '13.08, 80.27');
    assert.equal(formatLocation(null, 80.27), 'not set');
  });

  it('has no em dashes in what it shows', () => {
    const shown = [
      LOCATION_CHANGE_NOTE,
      locationErrorMessage(new BaseError('x', 403)).message,
      locationErrorMessage(new BaseError('x', 0)).message,
      parseLocation('', '').ok ? '' : (parseLocation('', '') as { error: string }).error,
    ];
    for (const s of shown) assert.equal(/—/.test(s), false);
  });
});

describe('This phone\'s location for a Base', () => {
  const area = { lat: 13, lon: 80 };

  it('uses the GPS fix rounded to 2 decimals, the precision sent to the Base', () => {
    const r = phoneLocationResult({ kind: 'gps', latitude: 13.082712, longitude: 80.270691, accuracy: 23 }, area);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.source, 'gps');
    assert.equal(r.lat, '13.08');
    assert.equal(r.lon, '80.27');
    assert.match(r.note, /within about 20 m/);
    assert.match(r.note, /rounded to about 1 km/);
    // The fields must read back through the same parser the save uses.
    assert.deepEqual(parseLocation(r.lat, r.lon), { ok: true, value: { latitude: 13.08, longitude: 80.27 } });
  });

  it('describes poor or missing accuracy without inventing a number', () => {
    const far = phoneLocationResult({ kind: 'gps', latitude: -33.86, longitude: 151.21, accuracy: 2400 }, null);
    assert.match(far.ok ? far.note : '', /within about 2 km/);
    const none = phoneLocationResult({ kind: 'gps', latitude: -33.86, longitude: 151.21, accuracy: null }, null);
    assert.equal(none.ok, true);
    assert.doesNotMatch(none.ok ? none.note : '', /within/);
  });

  it('falls back to the approximate area and says why', () => {
    const cases: [Parameters<typeof phoneLocationResult>[0], RegExp][] = [
      [{ kind: 'failed', reason: 'denied' }, /not allowed/],
      [{ kind: 'failed', reason: 'off' }, /Location is turned off/],
      [{ kind: 'failed', reason: 'timeout' }, /in time/],
      [{ kind: 'failed', reason: 'unavailable' }, /could not get a GPS position/],
      [{ kind: 'failed', reason: 'unsupported' }, /does not read GPS/],
      [{ kind: 'gps', latitude: 91, longitude: 0 }, /not valid/],
      [{ kind: 'gps', latitude: Number.NaN, longitude: 0 }, /not valid/],
    ];
    for (const [fix, why] of cases) {
      const r = phoneLocationResult(fix, area);
      assert.equal(r.ok, true, JSON.stringify(fix));
      if (!r.ok) continue;
      assert.equal(r.source, 'area');
      assert.equal(r.lat, '13');
      assert.equal(r.lon, '80');
      assert.match(r.note, why);
      assert.match(r.note, /approximate area \(about 100 km\)/);
    }
  });

  it('asks for typed coordinates when neither GPS nor the area is available', () => {
    const r = phoneLocationResult({ kind: 'failed', reason: 'timeout' }, null);
    assert.equal(r.ok, false);
    assert.match(r.ok ? '' : r.error, /in time\. Enter the latitude and longitude instead\./);
    assert.equal(phoneLocationResult({ kind: 'failed', reason: 'denied' }, { lat: 200, lon: 0 }).ok, false);
  });
});
