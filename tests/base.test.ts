import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BaseError, configureBase, getBaseInfo, normalizeSetupCode, roundCoord, ssidFor } from '../src/lib/baseApi';
import { fixture, mockFetch } from './helpers';

// Fixtures are real responses from wildnetwork-base's wnbase.py (run locally), see wildnetwork/docs/BASE-FIELD-APP.md.
const BASE = 'http://10.42.0.1';

describe('Wildlife Network Base helpers', () => {
  it('reads setup codes as printed on the label', () => {
    assert.equal(normalizeSetupCode('abcd 2345'), 'ABCD2345');
    assert.equal(normalizeSetupCode('ABCD-2345'), 'ABCD2345');
    // No I, L, O, 0 or 1 in setup codes; wrong length is rejected.
    for (const bad of ['ABCD2341', 'ABCDO345', 'ABC2345', 'ABCD23456', '']) assert.equal(normalizeSetupCode(bad), null);
  });

  it('builds the hotspot name from the 4 label characters or a pasted name', () => {
    assert.equal(ssidFor('7a8d'), 'Wildlife Network-7A8D');
    assert.equal(ssidFor('Wildlife Network-7A8D'), 'Wildlife Network-7A8D');
    assert.equal(ssidFor('7A8'), null);
    assert.equal(ssidFor('7A8D9'), null);
  });

  it('rounds positions to about 1 km', () => {
    assert.equal(roundCoord(13.08271), 13.08);
    assert.equal(roundCoord(-71.0589), -71.06);
  });
});

describe('Base local API', () => {
  it('reads /api/info of a Base that is already registered (the app then keeps its key, no second device)', async () => {
    mockFetch([{ match: '/api/info', body: fixture('base-info-registered.json') }]);
    const info = await getBaseInfo(BASE);
    assert.equal(info.model, 'wildnetwork-base');
    assert.equal(info.hardwareId, '42975a84e76a87da');
    assert.equal(info.configured, true);
    assert.equal(info.deviceId, 'wnb_test');
    assert.equal(info.registration, 'registered');
    assert.deepEqual([info.latitude, info.longitude], [13.08, 80.27]);
  });

  it('sends the setup code as X-Setup-Code and returns the Base warnings', async () => {
    let headers: Record<string, string> = {};
    let body = '';
    const original = globalThis.fetch;
    globalThis.fetch = (async (_u: string, init?: RequestInit) => {
      headers = init?.headers as Record<string, string>;
      body = String(init?.body);
      return new Response(fixture('base-config-ok.json'), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    try {
      const r = await configureBase(BASE, 'ABCD2345', { name: 'Garden Base', latitude: 13.08, longitude: 80.27, roundCoords: 2 });
      assert.equal(headers['x-setup-code'], 'ABCD2345');
      assert.deepEqual(JSON.parse(body), { name: 'Garden Base', latitude: 13.08, longitude: 80.27, roundCoords: 2 });
      assert.equal(r.ok, true);
      assert.ok(r.warnings?.some((w) => w.startsWith('Wi-Fi uplink not saved')));
    } finally {
      globalThis.fetch = original;
    }
  });

  it('explains a wrong setup code', async () => {
    mockFetch([{ match: '/api/config', body: fixture('base-config-wrong-code.json'), status: 403 }]);
    await assert.rejects(configureBase(BASE, 'WRONGCOD', { name: 'x' }), (e: Error) => e instanceof BaseError && /setup code is not right/.test(e.message));
  });

  it('turns a network failure into an actionable message', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => { throw new TypeError('Network request failed'); }) as typeof fetch;
    try {
      await assert.rejects(getBaseInfo(BASE), (e: Error) => e instanceof BaseError && /Could not reach the Base/.test(e.message));
    } finally {
      globalThis.fetch = original;
    }
  });
});
