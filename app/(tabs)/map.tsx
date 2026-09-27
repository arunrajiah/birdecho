/**
 * Map tab
 *
 * Renders all saved stations that have GPS coordinates as markers on an
 * interactive map.  Currently only BirdWeather stations carry coordinates
 * (fetched from the station API on connect).  BirdNET-Go and BirdNET-Pi
 * stations show a prompt instead of the map.
 *
 * Tapping a marker opens a callout; tapping "Switch" in the callout makes
 * that station the active one.  Tapping "Open in Maps" hands off to the
 * device's native maps app.
 *
 * Android: the native map requires a Google Maps API key.  Mounting MapView
 * without one crashes the app (grey screen → crash — issue #25), so on Android
 * we only render the map when a key was baked in at prebuild; otherwise the tab
 * shows a station list with "Open in Maps" links.  F-Droid builds never have a
 * key and additionally exclude react-native-maps at the native level (it depends
 * on Google Play Services), which is why the native map lives in
 * src/components/StationMap.tsx and is require()d lazily: that module must never
 * be evaluated when the map is unavailable.  Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
 * before `expo prebuild` to enable the map.  iOS uses Apple Maps and needs no key.
 */

import { useMemo, useCallback } from 'react';
import { View, Text, Pressable, Linking, Platform, ScrollView } from 'react-native';
import Constants from 'expo-constants';
import { useStationStore } from '../../src/stores/stationStore';
import type { SavedStation } from '../../src/types/station';
import type { MappableStation } from '../../src/components/StationMap';

// Android needs a Google Maps API key to mount MapView safely; iOS (Apple Maps)
// does not. `hasGoogleMapsKey` is set in app.config.ts at prebuild time.
const MAP_AVAILABLE =
  Platform.OS !== 'android' || Constants.expoConfig?.extra?.hasGoogleMapsKey === true;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function openInMaps(latitude: number, longitude: number, label: string) {
  const encodedLabel = encodeURIComponent(label);
  const url =
    Platform.OS === 'ios'
      ? `maps:0,0?q=${encodedLabel}@${latitude},${longitude}`
      : `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedLabel})`;
  void Linking.openURL(url);
}

const CONNECTION_BADGE: Record<string, string> = {
  birdweather: 'BirdWeather',
  birdnetgo: 'BirdNET-Go',
  birdnetpi: 'BirdNET-Pi',
};

// ─── Fallback when the native map is unavailable: station list ───────────────

function StationList({
  stations,
  activeStationId,
  onSwitch,
}: {
  stations: MappableStation[];
  activeStationId: string | null;
  onSwitch: (id: string) => void;
}) {
  return (
    <ScrollView className="flex-1 bg-white dark:bg-gray-950" contentContainerClassName="p-4 gap-3">
      <Text className="text-xs text-gray-500 dark:text-gray-400 mb-1">
        The interactive map is not available in this build. Tap a station to open its location
        in your maps app.
      </Text>
      {stations.map((station) => {
        const isActive = station.id === activeStationId;
        return (
          <View
            key={station.id}
            className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 gap-1"
          >
            <Text
              className="text-base font-semibold text-gray-900 dark:text-gray-100"
              numberOfLines={1}
            >
              {station.stationName}
            </Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400">
              {CONNECTION_BADGE[station.connectionType] ?? station.connectionType} ·{' '}
              {station.latitude.toFixed(4)}, {station.longitude.toFixed(4)}
            </Text>
            <View className="flex-row gap-2 mt-3">
              {isActive ? (
                <View className="flex-1 items-center rounded-md bg-green-100 dark:bg-green-900 py-2">
                  <Text className="text-xs font-semibold text-green-700 dark:text-green-200">
                    Active
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => onSwitch(station.id)}
                  className="flex-1 items-center rounded-md bg-green-700 py-2"
                >
                  <Text className="text-xs font-semibold text-white">Switch</Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => openInMaps(station.latitude, station.longitude, station.stationName)}
                className="flex-1 items-center rounded-md border border-gray-300 dark:border-gray-700 py-2"
              >
                <Text className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                  Open in Maps ↗
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── Map screen ───────────────────────────────────────────────────────────────

export default function MapScreen() {
  const stations = useStationStore((s) => s.stations);
  const activeStationId = useStationStore((s) => s.activeStationId);
  const switchStation = useStationStore((s) => s.switchStation);

  // Only stations with coordinates appear on the map.
  const mappableStations = useMemo(
    () =>
      stations.filter(
        (s): s is MappableStation =>
          typeof s.latitude === 'number' && typeof s.longitude === 'number',
      ),
    [stations],
  );

  const handleSwitch = useCallback(
    (id: string) => {
      void switchStation(id);
    },
    [switchStation],
  );

  // ── No stations with location data ─────────────────────────────────────────
  if (mappableStations.length === 0) {
    const hasBirdWeather = stations.some((s: SavedStation) => s.connectionType === 'birdweather');
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Text className="text-4xl mb-4">🗺️</Text>
        {stations.length === 0 ? (
          <>
            <Text className="text-center text-base font-semibold text-gray-900 mb-2">
              No station connected
            </Text>
            <Text className="text-center text-sm text-gray-400">
              Connect a BirdWeather station to see where it is.
            </Text>
          </>
        ) : hasBirdWeather ? (
          <>
            <Text className="text-center text-base font-semibold text-gray-900 mb-2">
              Location data unavailable
            </Text>
            <Text className="text-center text-sm text-gray-400">
              Your BirdWeather station does not appear to have GPS coordinates. This sometimes
              happens with private stations. Check your station settings on app.birdweather.com.
            </Text>
          </>
        ) : (
          <>
            <Text className="text-center text-base font-semibold text-gray-900 mb-2">
              Locations available for BirdWeather stations
            </Text>
            <Text className="text-center text-sm text-gray-400">
              BirdNET-Go and BirdNET-Pi stations do not expose GPS coordinates. Add a BirdWeather
              station to see where it is.
            </Text>
          </>
        )}
      </View>
    );
  }

  // ── Map unavailable (Android build without a Google Maps key, incl. F-Droid) ─
  if (!MAP_AVAILABLE) {
    return (
      <StationList
        stations={mappableStations}
        activeStationId={activeStationId}
        onSwitch={handleSwitch}
      />
    );
  }

  // Lazy require: react-native-maps must not be evaluated when the map is
  // unavailable (F-Droid builds do not even link the native module).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const StationMap = (require('../../src/components/StationMap') as typeof import('../../src/components/StationMap')).default;
  return (
    <StationMap
      stations={mappableStations}
      activeStationId={activeStationId}
      onSwitch={handleSwitch}
      onOpenMaps={(s) => openInMaps(s.latitude, s.longitude, s.stationName)}
    />
  );
}
