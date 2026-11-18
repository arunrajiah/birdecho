import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HOTSPOT_POLL, isBaseInfo, nameUrls, pollUntil, serviceUrls, suffixFrom, verifyBases } from '../src/lib/baseFind';
import { fixture } from './helpers';

const info = JSON.parse(fixture('base-info-registered.json')) as Record<string, unknown>;

describe('Base discovery candidates', () => {
  it('turns an mDNS service into IPv4 addresses first, then its .local name', () => {
    assert.deepEqual(
      serviceUrls({ hostName: 'wildnetwork-base-7a8d.local.', addresses: ['fe80::1', '192.168.1.11'], port: 80 }),
      ['http://192.168.1.11', 'http://wildnetwork-base-7a8d.local'],
    );
    assert.deepEqual(serviceUrls({ hostName: 'wlnw-base-7a8d.local', addresses: ['192.168.1.11'], port: 8000 }), [
      'http://192.168.1.11:8000',
      'http://wlnw-base-7a8d.local:8000',
    ]);
    // Loopback and self-assigned addresses are never the Base.
    assert.deepEqual(serviceUrls({ addresses: ['127.0.0.1', '169.254.3.4'], port: 80 }), []);
    assert.deepEqual(serviceUrls({}), []);
  });

  it('guesses host names from hotspot names or label characters', () => {
    assert.equal(suffixFrom('Wildlife Network-7A8D'), '7a8d');
    assert.equal(suffixFrom(' 7a8d '), '7a8d');
    assert.equal(suffixFrom('7A8'), null);
    assert.equal(suffixFrom(''), null);
    assert.deepEqual(nameUrls(['Wildlife Network-7A8D', '7a8d', null, 'nope!']), [
      'http://wlnw-base-7a8d.local',
      'http://wildnetwork-base-7a8d.local',
    ]);
  });

  it('accepts only /api/info from a Wildlife Network Base', () => {
    assert.equal(isBaseInfo(info), true);
    assert.equal(isBaseInfo({ ...info, model: 'birdnet-go' }), false);
    assert.equal(isBaseInfo({ model: 'wildnetwork-base' }), false);
    assert.equal(isBaseInfo(null), false);
  });
});

describe('Verifying candidates', () => {
  it('keeps one entry per Base, at the first address that answered, and drops other devices', async () => {
    const answers: Record<string, unknown> = {
      'http://192.168.1.11': info,
      'http://wildnetwork-base-7a8d.local': info,
      'http://192.168.1.20': { model: 'something-else', hardwareId: 'x' },
      'http://192.168.1.30': { ...info, hardwareId: 'second', name: 'Pond Base' },
    };
    const asked: string[] = [];
    const found = await verifyBases(
      ['http://192.168.1.11', 'http://wildnetwork-base-7a8d.local', 'http://192.168.1.20', 'http://192.168.1.30', 'http://192.168.1.11', 'http://down'],
      async (u) => {
        asked.push(u);
        if (!(u in answers)) throw new Error('unreachable');
        return answers[u];
      },
    );
    assert.deepEqual(found.map((b) => [b.url, b.info.hardwareId]), [
      ['http://192.168.1.11', '42975a84e76a87da'],
      ['http://192.168.1.30', 'second'],
    ]);
    assert.equal(asked.length, 5, 'each address is asked once');
  });
});

describe('Waiting for the Base on its hotspot', () => {
  // A fake clock: sleep moves time on at once, so the test runs instantly.
  function clock() {
    let t = 0;
    return { now: () => t, sleep: async (ms: number) => { t += ms; } };
  }

  it('goes on as soon as the Base answers', async () => {
    const c = clock();
    let tries = 0;
    const v = await pollUntil(async () => (++tries === 4 ? 'info' : null), { intervalMs: 3000, timeoutMs: 60_000, ...c });
    assert.equal(v, 'info');
    assert.equal(tries, 4);
    assert.equal(c.now(), 9000);
  });

  it('treats a failed request as no answer yet and gives up after the timeout', async () => {
    const c = clock();
    let tries = 0;
    const v = await pollUntil(async () => { tries++; throw new Error('not on the hotspot'); }, { intervalMs: 3000, timeoutMs: 10_000, ...c });
    assert.equal(v, null);
    assert.equal(tries, 4); // at 0, 3, 6 and 9 s
  });

  it('stops when cancelled (screen left)', async () => {
    const c = clock();
    let tries = 0;
    const v = await pollUntil(async () => { tries++; return null; }, { intervalMs: 3000, timeoutMs: 60_000, cancelled: () => tries >= 2, ...c });
    assert.equal(v, null);
    assert.equal(tries, 2);
  });

  it('waits a sensible time: a few seconds between tries, each shorter than the gap, minutes in all', () => {
    assert.ok(HOTSPOT_POLL.requestMs < HOTSPOT_POLL.intervalMs);
    assert.ok(HOTSPOT_POLL.timeoutMs >= 2 * 60_000);
  });
});
