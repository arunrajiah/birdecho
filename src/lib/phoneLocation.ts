/**
 * This phone's location for setting where a Base stands: one GPS reading at balanced accuracy (about 100 m, plenty
 * for a position rounded to about 1 km) while the app is open (never in the background), falling back to the approximate area from Wildlife Network when permission is refused, location is
 * off, GPS times out, or the build has no GPS module.
 *
 * The F-Droid build leaves expo-location out (it needs Google Play services on Android, see
 * scripts/fdroid-prepare.mjs), so the module is only loaded when its native side is linked.
 */
import { requireOptionalNativeModule } from 'expo';
import { phoneLocationResult, type PhoneFix, type PhoneLocation } from './baseLocation';
import { fetchNear } from './wildnetwork';

type ExpoLocation = typeof import('expo-location');

const GPS_TIMEOUT_MS = 15000;

function locationModule(): ExpoLocation | null {
  if (!requireOptionalNativeModule('ExpoLocation')) return null;
  // Loaded lazily: importing it without its native side (F-Droid build) throws.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-location') as ExpoLocation;
}

/** Whether this build can read GPS at all (false in the F-Droid build). */
export const canUseGps = locationModule() != null;

/**
 * One GPS reading. With prompt false it never shows the permission dialog and reports 'denied' unless location
 * was already allowed (used to fill a form quietly when it opens).
 */
export async function readGps(prompt: boolean): Promise<PhoneFix> {
  const Location = locationModule();
  if (!Location) return { kind: 'failed', reason: 'unsupported' };
  try {
    const perm = prompt ? await Location.requestForegroundPermissionsAsync() : await Location.getForegroundPermissionsAsync();
    if (!perm.granted) return { kind: 'failed', reason: 'denied' };
    if (!(await Location.hasServicesEnabledAsync())) return { kind: 'failed', reason: 'off' };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), GPS_TIMEOUT_MS);
    });
    const pos = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), timeout]).finally(() =>
      clearTimeout(timer),
    );
    if (!pos) return { kind: 'failed', reason: 'timeout' };
    return { kind: 'gps', latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
  } catch {
    return { kind: 'failed', reason: 'unavailable' };
  }
}

/** GPS first; the approximate area only when GPS gave nothing. */
export async function getPhoneLocation(prompt = true): Promise<PhoneLocation> {
  const fix = await readGps(prompt);
  const gps = phoneLocationResult(fix, null);
  return gps.ok ? gps : phoneLocationResult(fix, await fetchNear());
}
