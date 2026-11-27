/**
 * Changing the Wi-Fi of a Wildlife Network Base, for example after it was moved: checking what was typed and
 * building the POST /api/config request. The Base keeps one home Wi-Fi network: the new one replaces the old one
 * (wildnetwork-base wnnet.save_uplink). Pure, so it runs under the Node test runner.
 */
import { BaseError, type BaseConfig } from './baseApi';
import { pickSetupCode, type Parsed } from './baseLocation';

/** Same limits as the Base (wnbase.py POST /api/config): name 1 to 32 bytes, password 8 to 63 plain characters. */
export function parseWifi(ssid: string, psk: string): Parsed<{ ssid: string; psk: string }> {
  const name = ssid.trim();
  const bytes = new TextEncoder().encode(name).length;
  if (!name) return { ok: false, error: 'Enter the name of the Wi-Fi network.' };
  if (bytes > 32) return { ok: false, error: 'A Wi-Fi name is at most 32 characters.' };
  if (!psk) return { ok: false, error: 'Enter the Wi-Fi password. The Base cannot join Wi-Fi without a password.' };
  if (psk.length < 8 || psk.length > 63) return { ok: false, error: 'A Wi-Fi password is 8 to 63 characters.' };
  if (!/^[\x20-\x7e]+$/.test(psk)) return { ok: false, error: 'The Base only accepts Wi-Fi passwords made of plain letters, digits and symbols.' };
  return { ok: true, value: { ssid: name, psk } };
}

export interface WifiRequest {
  code: string;
  config: Pick<BaseConfig, 'wifi'>;
}

/** The setup code and body for POST /api/config: only the Wi-Fi, so nothing else on the Base changes. */
export function buildWifiRequest(ssid: string, psk: string, savedCode: string | null | undefined, typedCode: string): Parsed<WifiRequest> {
  const wifi = parseWifi(ssid, psk);
  if (!wifi.ok) return wifi;
  const code = pickSetupCode(savedCode, typedCode);
  if (!code.ok) return code;
  return { ok: true, value: { code: code.value, config: { wifi: wifi.value } } };
}

/** How the Base moves to the new network (wnnet.py: retry every 5 minutes while no phone is on its Wi-Fi). */
export const WIFI_CHANGE_NOTE =
  'The Base joins the new Wi-Fi within about 5 minutes after this phone leaves its Wi-Fi, or when it is next switched on. If it cannot join (wrong password, or the network is out of range), its own Wi-Fi comes back so you can try again.';

/** What to tell the user when saving failed, and whether to ask for the setup code. */
export function wifiErrorMessage(e: unknown): { message: string; askForCode: boolean } {
  if (e instanceof BaseError) {
    if (e.status === 403) return { message: 'The setup code is not right. Check the label on the Base, or wildnetwork-setup.txt on its SD card.', askForCode: true };
    if (e.status === 0) {
      return {
        message: 'Could not reach the Base. Stand next to it and make sure it has been on for at least 2 minutes, so its own Wi-Fi is on, then try again.',
        askForCode: false,
      };
    }
    return { message: e.message, askForCode: false };
  }
  return { message: e instanceof Error ? e.message : 'Something went wrong.', askForCode: false };
}
