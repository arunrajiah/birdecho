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
 * Android: map tiles require a Google Maps API key.  Without one the tiles
 * are blank but all markers and interactions still work.  Set
 * EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in your environment before `expo prebuild`.
 */
import { useRef, useMemo, useCallback } from 'react';
import { View, Text, Pressable, Linking, Platform } from 'react-native';
import MapView, { Marker, Callout, type Region } from 'react-native-maps';
import { useStationStore } from '../../src/stores/stationStore';
import type { SavedStation } from '../../src/types/station';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function openInMaps(latitude: number, longitude: number, label: string) {
  const encodedLabel = encodeURIComponent(label);
  const url =
    Platform.OS === 'ios'
      ? `maps:0,0?q=${encodedLabel}@${latitude},${longitude}`
      : `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedLabel})`;
  void Linking.openURL(url);
}

/**
 * Compute a map region that fits all provided coordinates with a small
 * padding margin.
 */
function regionForCoordinates(
  coords: { latitude: number; longitude: number }[],
): Region {
  if (coords.length === 0) {
    return { latitude: 20, longitude: 0, latitudeDelta: 120, longitudeDelta: 120 };
  }
  if (coords.length === 1) {
    const { latitude, longitude } = coords[0]!;
    return { latitude, longitude, latitudeDelta: 0.5, longitudeDelta: 0.5 };
  }

  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const padding = 0.3;
  const latDelta = maxLat - minLat + padding * 2;
  const lngDelta = maxLng - minLng + padding * 2;

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(latDelta, 0.5),
    longitudeDelta: Math.max(lngDelta, 0.5),
  };
}

const CONNECTION_BADGE: Record<string, string> = {
  birdweather: 'BirdWeather',
  birdnetgo: 'BirdNET-Go',
  birdnetpi: 'BirdNET-Pi',
};

// ─── Marker callout ───────────────────────────────────────────────────────────

function StationCallout({
  station,
  isActive,
  onSwitch,
  onOpenMaps,
}: {
  station: SavedStation;
  isActive: boolean;
  onSwitch: () => void;
  onOpenMaps: () => void;
}) {
  return (
    <Callout onPress={() => {}} tooltip={false} style={{ width: 200 }}>
      <View style={{ padding: 10, gap: 6 }}>
        <Text style={{ fontWeight: '700', fontSize: 14, color: '#111827' }} numberOfLines={1}>
          {station.stationName}
        </Text>
        <Text style={{ fontSize: 12, color: '#6b7280' }}>
          {CONNECTION_BADGE[station.connectionType] ?? station.connectionType}
        </Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          {!isActive ? (
            <Pressable
              onPress={onSwitch}
              style={{
                flex: 1,
                backgroundColor: '#15803d',
                borderRadius: 6,
                paddingVertical: 5,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Switch</Text>
            </Pressable>
          ) : (
            <View
              style={{
                flex: 1,
                backgroundColor: '#dcfce7',
                borderRadius: 6,
                paddingVertical: 5,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#15803d', fontSize: 12, fontWeight: '600' }}>Active</Text>
            </View>
          )}

          <Pressable
            onPress={onOpenMaps}
            style={{
              flex: 1,
              borderColor: '#d1d5db',
              borderWidth: 1,
              borderRadius: 6,
              paddingVertical: 5,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#374151', fontSize: 12, fontWeight: '600' }}>Maps ↗</Text>
          </Pressable>
        </View>
      </View>
    </Callout>
  );
}

// ─── Map screen ───────────────────────────────────────────────────────────────

export default function MapScreen() {
  const stations = useStationStore((s) => s.stations);
  const activeStationId = useStationStore((s) => s.activeStationId);
  const switchStation = useStationStore((s) => s.switchStation);
  const mapRef = useRef<MapView>(null);

  // Only stations with coordinates appear on the map.
  const mappableStations = useMemo(
    () =>
      stations.filter(
        (s): s is SavedStation & { latitude: number; longitude: number } =>
          typeof s.latitude === 'number' && typeof s.longitude === 'number',
      ),
    [stations],
  );

  const initialRegion = useMemo(
    () => regionForCoordinates(mappableStations),
    // We only want this on first render — ignore subsequent changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleSwitch = useCallback(
    (id: string) => {
      void switchStation(id);
    },
    [switchStation],
  );

  // ── No stations with location data ─────────────────────────────────────────
  if (mappableStations.length === 0) {
    const hasBirdWeather = stations.some((s) => s.connectionType === 'birdweather');
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Text className="text-4xl mb-4">🗺️</Text>
        {stations.length === 0 ? (
          <>
            <Text className="text-center text-base font-semibold text-gray-900 mb-2">
              No station connected
            </Text>
            <Text className="text-center text-sm text-gray-400">
              Connect a BirdWeather station to see it on the map.
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
              Map available for BirdWeather stations
            </Text>
            <Text className="text-center text-sm text-gray-400">
              BirdNET-Go and BirdNET-Pi stations do not expose GPS coordinates. Add a BirdWeather
              station to see it on the map.
            </Text>
          </>
        )}
      </View>
    );
  }

  return (
    <View className="flex-1">
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {mappableStations.map((station) => {
          const isActive = station.id === activeStationId;
          return (
            <Marker
              key={station.id}
              coordinate={{ latitude: station.latitude, longitude: station.longitude }}
              pinColor={isActive ? '#15803d' : '#78716C'}
              title={station.stationName}
            >
              <StationCallout
                station={station}
                isActive={isActive}
                onSwitch={() => handleSwitch(station.id)}
                onOpenMaps={() =>
                  openInMaps(station.latitude, station.longitude, station.stationName)
                }
              />
            </Marker>
          );
        })}
      </MapView>

      {/* Legend when multiple stations are visible */}
      {mappableStations.length > 1 && (
        <View
          style={{
            position: 'absolute',
            bottom: 24,
            left: 16,
            right: 16,
            backgroundColor: 'rgba(255,255,255,0.92)',
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#15803d' }} />
            <Text style={{ fontSize: 12, color: '#374151' }}>Active station</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#78716C' }} />
            <Text style={{ fontSize: 12, color: '#374151' }}>Other stations</Text>
          </View>
        </View>
      )}
    </View>
  );
}
