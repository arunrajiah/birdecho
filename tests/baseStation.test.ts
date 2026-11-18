import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  baseApiUrlFor,
  baseFeedUrl,
  isBaseStation,
  planBaseStation,
  planRemoval,
  sameAddress,
  startRoute,
} from '../src/lib/baseStation';
import type { BaseInfo } from '../src/lib/baseApi';
import type { SavedStation } from '../src/types/station';
import { fixture } from './helpers';

// /api/info of a Base with BirdNET-Go installed (software.birdnetGo is the image tag), as wnbase.py builds it.
const withGo: BaseInfo = {
  ...(JSON.parse(fixture('base-info-registered.json')) as BaseInfo),
  hostname: 'wildnetwork-base-7a8d',
  software: { wnbase: '0.1.0', 'wdx-agent': '0.4.2', birdnetGo: 'nightly' },
};
const noGo: BaseInfo = JSON.parse(fixture('base-info-registered.json')) as BaseInfo; // birdnetGo: null
const base = { hardwareId: withGo.hardwareId, name: 'Garden Base' };

const demo: SavedStation = { id: 'd', connectionType: 'demo', stationName: 'Demo station' };
const go = (id: string, hostUrl: string, baseId?: string): SavedStation => ({
  id,
  connectionType: 'birdnetgo',
  stationName: id,
  hostUrl,
  ...(baseId ? { baseId } : {}),
});

describe('Base addresses', () => {
  it('compares addresses by scheme, host and port', () => {
    assert.equal(sameAddress('http://192.168.1.50:8080', 'http://192.168.1.50:8080/'), true);
    assert.equal(sameAddress('HTTP://Base.local:8080', 'http://base.local:8080'), true);
    assert.equal(sameAddress('http://192.168.1.50', 'http://192.168.1.50:80'), true);
    assert.equal(sameAddress('http://192.168.1.50', 'http://192.168.1.50:8080'), false);
    assert.equal(sameAddress('http://192.168.1.50:8080', 'https://192.168.1.50:8080'), false);
    assert.equal(sameAddress(undefined, 'http://192.168.1.50'), false);
    assert.equal(sameAddress('not a url', 'not a url'), false);
  });

  it('finds the setup API next to a BirdNET-Go address', () => {
    assert.equal(baseApiUrlFor('http://192.168.1.50:8080'), 'http://192.168.1.50');
    assert.equal(baseApiUrlFor('http://wildnetwork-base-7a8d.local:8080/ui'), 'http://wildnetwork-base-7a8d.local');
    assert.equal(baseApiUrlFor('192.168.1.50'), null);
  });

  it('uses the home network address with port 8080, or the host name when set up over the hotspot', () => {
    assert.equal(baseFeedUrl('http://192.168.1.50', withGo), 'http://192.168.1.50:8080');
    assert.equal(baseFeedUrl('http://192.168.1.50:80/', withGo), 'http://192.168.1.50:8080');
    assert.equal(baseFeedUrl('http://10.42.0.1', withGo), 'http://wildnetwork-base-7a8d.local:8080');
    assert.equal(baseFeedUrl('http://10.42.0.1', { hostname: '' }), null);
  });
});

describe('Station for a new Base', () => {
  it('adds a BirdNET-Go station named after the Base', () => {
    assert.deepEqual(planBaseStation([demo], base, withGo, 'http://192.168.1.50'), {
      kind: 'add',
      hostUrl: 'http://192.168.1.50:8080',
      stationName: 'Garden Base',
    });
  });

  it('links a station that already has that address instead of adding a duplicate', () => {
    const stations = [demo, go('mine', 'http://192.168.1.50:8080/')];
    assert.deepEqual(planBaseStation(stations, base, withGo, 'http://192.168.1.50'), { kind: 'link', stationId: 'mine' });
  });

  it('does nothing without BirdNET-Go or when a station is already linked to this Base', () => {
    assert.deepEqual(planBaseStation([demo], base, noGo, 'http://192.168.1.50'), { kind: 'none' });
    const linked = [go('feed', 'http://10.0.0.9:8080', base.hardwareId)];
    assert.deepEqual(planBaseStation(linked, base, withGo, 'http://192.168.1.50'), { kind: 'none' });
  });
});

describe('Base stations and sharing', () => {
  it('treats a station linked to a Base as already shared', () => {
    assert.equal(isBaseStation(go('feed', 'http://192.168.1.50:8080', 'hw1')), true);
    assert.equal(isBaseStation(go('other', 'http://192.168.1.60:8080')), false);
    assert.equal(isBaseStation(null), false);
  });
});

describe('Removing a station', () => {
  it('removes one of several stations without a reset', () => {
    const p = planRemoval([demo, go('g', 'http://a:8080')], 'd', 0);
    assert.equal(p.outcome, 'remove');
    assert.match(p.message, /Remove "Demo station"/);
  });

  it('keeps Bases and stays in the app when the last station goes', () => {
    const p = planRemoval([demo], 'd', 1);
    assert.equal(p.outcome, 'last-keep-bases');
    assert.match(p.message, /Your Base stays saved/);
    assert.match(planRemoval([demo], 'd', 2).message, /Your 2 Bases stay saved/);
  });

  it('says it starts over only when no station and no Base is left', () => {
    const p = planRemoval([demo], 'd', 0);
    assert.equal(p.outcome, 'last-reset');
    assert.match(p.message, /welcome screen/);
  });

  it('says the Base keeps sharing when its feed station is removed', () => {
    assert.match(planRemoval([demo, go('g', 'http://a:8080', 'hw1')], 'g', 1).message, /keeps recording and sharing/);
  });

  it('has no em dashes in what it shows', () => {
    for (const p of [planRemoval([demo], 'd', 0), planRemoval([demo], 'd', 1), planRemoval([demo, go('g', 'http://a:8080', 'hw1')], 'g', 1)]) {
      assert.equal(/—/.test(p.title + p.message + p.confirm), false);
    }
  });
});

describe('Start screen', () => {
  it('opens the Feed with a station, Settings with only Bases, else the welcome screen', () => {
    assert.equal(startRoute(true, 0), 'feed');
    assert.equal(startRoute(true, 2), 'feed');
    assert.equal(startRoute(false, 1), 'settings');
    assert.equal(startRoute(false, 0), 'welcome');
  });
});
