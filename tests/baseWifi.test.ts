import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BaseError } from '../src/lib/baseApi';
import { buildWifiRequest, parseWifi, wifiErrorMessage } from '../src/lib/baseWifi';

describe('parseWifi', () => {
  it('accepts a normal network and trims the name, not the password', () => {
    assert.deepEqual(parseWifi('  Field Station ', ' pass word1'), { ok: true, value: { ssid: 'Field Station', psk: ' pass word1' } });
  });
  it('follows the Base limits', () => {
    assert.equal(parseWifi('', 'password1').ok, false);
    assert.equal(parseWifi('a'.repeat(32), 'password1').ok, true);
    assert.equal(parseWifi('a'.repeat(33), 'password1').ok, false);
    // 11 three-byte characters are 33 bytes: too long for Wi-Fi.
    assert.equal(parseWifi('மமமமமமமமமமம', 'password1').ok, false);
    assert.equal(parseWifi('Home', '').ok, false);
    assert.equal(parseWifi('Home', 'short').ok, false);
    assert.equal(parseWifi('Home', 'x'.repeat(63)).ok, true);
    assert.equal(parseWifi('Home', 'x'.repeat(64)).ok, false);
    assert.equal(parseWifi('Home', 'pässwörd12').ok, false);
  });
});

describe('buildWifiRequest', () => {
  it('sends only the Wi-Fi, with the saved setup code', () => {
    const r = buildWifiRequest('Farm', 'hunter2hunter', 'ABCD EFGH', '');
    assert.deepEqual(r, { ok: true, value: { code: 'ABCDEFGH', config: { wifi: { ssid: 'Farm', psk: 'hunter2hunter' } } } });
  });
  it('prefers a typed code and asks for one when none is saved', () => {
    const r = buildWifiRequest('Farm', 'hunter2hunter', 'ABCDEFGH', 'wxyz-2345');
    assert.equal(r.ok && r.value.code, 'WXYZ2345');
    assert.equal(buildWifiRequest('Farm', 'hunter2hunter', '', '').ok, false);
  });
  it('checks the Wi-Fi before the code', () => {
    const r = buildWifiRequest('', 'hunter2hunter', '', '');
    assert.equal(!r.ok && r.error, 'Enter the name of the Wi-Fi network.');
  });
});

describe('wifiErrorMessage', () => {
  it('asks for the code on 403 and explains the Base Wi-Fi when unreachable', () => {
    assert.equal(wifiErrorMessage(new BaseError('x', 403)).askForCode, true);
    assert.match(wifiErrorMessage(new BaseError('x', 0)).message, /own Wi-Fi/);
    assert.equal(wifiErrorMessage(new BaseError('A different Base answered.', 409)).message, 'A different Base answered.');
  });
});
