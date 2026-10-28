/**
 * Joining a Wildlife Network Base's hotspot (native, Android 10+). The Base's local API and the setup-code
 * helpers live in baseApi.ts and are re-exported here.
 */
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { hotspotPassword } from './baseApi';

export * from './baseApi';

interface BaseWifiNative {
  isSupported(): boolean;
  connect(ssid: string, passphrase: string, timeoutMs: number): Promise<'connected' | 'unavailable' | 'unsupported'>;
  bind(): boolean;
  unbind(): boolean;
  disconnect(): boolean;
}

const native =
  Platform.OS === 'android' ? requireOptionalNativeModule<BaseWifiNative>('BirdEchoBaseWifi') : null;

/** True when the app can join the hotspot itself (Android 10+); otherwise the user joins in Wi-Fi settings. */
export function canJoinHotspot(): boolean {
  try {
    return !!native?.isSupported();
  } catch {
    return false;
  }
}

export async function joinHotspot(ssid: string, code: string): Promise<'connected' | 'unavailable' | 'unsupported'> {
  if (!native) return 'unsupported';
  return native.connect(ssid, hotspotPassword(code), 60_000);
}

/** Send the app's requests to the Base (true) or back over the normal network (false). */
export function routeToBase(on: boolean): void {
  try {
    if (on) native?.bind();
    else native?.unbind();
  } catch {
    // Not joined through the app (manual join or older Android): normal routing already reaches the Base.
  }
}

export function leaveHotspot(): void {
  try {
    native?.disconnect();
  } catch {
    // Nothing to release.
  }
}

