/**
 * Sends the active station to the BirdEcho Wear OS app (wear/) so the watch can
 * fetch detections on its own. Best-effort: a no-op on iOS and on builds without
 * the native module (F-Droid excludes it because it needs Google Play Services).
 */

import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { getTokenForStation } from './secureStorage';
import type { SavedStation } from '../types/station';

interface WearSyncNativeModule {
  sendStation(station: Record<string, string | undefined>): Promise<boolean>;
  clearStation(): Promise<boolean>;
}

const native =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<WearSyncNativeModule>('BirdEchoWearSync')
    : null;

export async function syncStationToWatch(station: SavedStation | null): Promise<void> {
  if (!native) return;
  try {
    if (!station) {
      await native.clearStation();
      return;
    }
    const token =
      station.connectionType === 'birdweather'
        ? ((await getTokenForStation(station.id)) ?? undefined)
        : undefined;
    await native.sendStation({
      connectionType: station.connectionType,
      stationName: station.stationName,
      bwStationId: station.bwStationId,
      hostUrl: station.hostUrl,
      token,
    });
  } catch {
    // Never let a watch sync failure affect the phone app.
  }
}
