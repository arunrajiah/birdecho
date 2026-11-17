import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fetchLastReport, installCommand, isSolidArrival, subscribeAlert } from '../src/lib/wildnetwork';

// Values as returned by Wildlife Network /api/v1/arrivals for the Boston cell (40,-75), 2026-10-07.
describe('Wildlife Network arrivals filter', () => {
  it('drops weak seasons and keeps solid or unscored ones', () => {
    assert.equal(isSolidArrival({ arrivalSupport: 0.28 }), false); // Eurasian Curlew
    assert.equal(isSolidArrival({ arrivalSupport: 0.78 }), true); // Long-eared Owl
    assert.equal(isSolidArrival({ arrivalSupport: 1 }), true); // White-crowned Sparrow
    assert.equal(isSolidArrival({ arrivalSupport: 0.5 }), true);
    assert.equal(isSolidArrival({ arrivalSupport: null }), true);
    assert.equal(isSolidArrival({}), true);
  });
});

describe('Wildlife Network species alerts', () => {
  const ok = (async () => new Response(JSON.stringify({ ok: true, message: 'Almost done: check your inbox and confirm.' }), { status: 200 })) as unknown as typeof fetch;
  it('checks the email and place before sending', async () => {
    await assert.rejects(subscribeAlert({ email: 'nope', species: 'Turdus merula', place: 'Leeds' }, ok), /valid email/);
    await assert.rejects(subscribeAlert({ email: 'a@b.org', species: 'Turdus merula', place: ' ' }, ok), /town or city/);
  });
  it('posts a subscribe request and returns the site message', async () => {
    let sent: { url: string; body: unknown } | null = null;
    const f = (async (url: string, init: RequestInit) => { sent = { url, body: JSON.parse(String(init.body)) }; return new Response(JSON.stringify({ ok: true, message: 'Check your inbox' }), { status: 200 }); }) as unknown as typeof fetch;
    assert.equal(await subscribeAlert({ email: ' a@b.org ', species: 'Turdus merula', place: 'Leeds' }, f), 'Check your inbox');
    assert.deepEqual(sent, { url: 'https://wlnw.org/api/v1/alerts', body: { action: 'subscribe', email: 'a@b.org', species: 'Turdus merula', place: 'Leeds' } });
  });
  it('passes the site error on', async () => {
    const f = (async () => new Response(JSON.stringify({ error: 'Unknown species.' }), { status: 400 })) as unknown as typeof fetch;
    await assert.rejects(subscribeAlert({ email: 'a@b.org', species: 'X y', place: 'Leeds' }, f), /Unknown species/);
  });
});

describe('Wildlife Network station status', () => {
  it('puts the device id in the install command when known', () => {
    assert.equal(installCommand('wn_k'), 'curl -fsSL https://wlnw.org/agent/install.sh | WDX_KEY=wn_k bash');
    assert.equal(installCommand('wn_k', 'dev_1'), 'curl -fsSL https://wlnw.org/agent/install.sh | WDX_KEY=wn_k WDX_DEVICE_ID=dev_1 bash');
  });
  it('reads the last report of this device only', async () => {
    const f = (async () => new Response(JSON.stringify({ devices: [{ id: 'a', lastReport: '2026-11-16T10:00:00Z' }, { id: 'b', lastReport: null }] }))) as unknown as typeof fetch;
    assert.equal((await fetchLastReport('a', f))?.toISOString(), '2026-11-16T10:00:00.000Z');
    assert.equal(await fetchLastReport('b', f), null);
    assert.equal(await fetchLastReport('zzz', f), null);
  });
});
