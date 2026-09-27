/**
 * Native station map (react-native-maps).
 *
 * Loaded lazily from the Map tab so that F-Droid builds, which exclude
 * react-native-maps at the native level (it depends on Google Play Services),
 * never evaluate this module. Keep every react-native-maps import in here.
 *
 * Android: MapView must only be mounted when a Google Maps API key was baked in
 * at prebuild (issue #25); the Map tab checks extra.hasGoogleMapsKey before
 * requiring this module.
 */

import { useMemo, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import MapView, { Marker, Callout, type Region } from 'react-native-maps';
import type { SavedStation } from '../types/station';

export type MappableStation = SavedStation & { latitude: number; longitude: number };

const CONNECTION_BADGE: Record<string, string> = {
  birdweather: 'BirdWeather',
  birdnetgo: 'BirdNET-Go',
  birdnetpi: 'BirdNET-Pi',
};

/**
 * Compute a map region that fits all provided coordinates with a small
 * padding margin.
 */
function regionForCoordinates(coords: { latitude: number; longitude: number }[]): Region {
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

// ─── Map ──────────────────────────────────────────────────────────────────────

export default function StationMap({
  stations,
  activeStationId,
  onSwitch,
  onOpenMaps,
}: {
  stations: MappableStation[];
  activeStationId: string | null;
  onSwitch: (id: string) => void;
  onOpenMaps: (station: MappableStation) => void;
}) {
  const mapRef = useRef<MapView>(null);

  const initialRegion = useMemo(
    () => regionForCoordinates(stations),
    // We only want this on first render — ignore subsequent changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <View className="flex-1">
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={initialRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {stations.map((station) => {
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
                onSwitch={() => onSwitch(station.id)}
                onOpenMaps={() => onOpenMaps(station)}
              />
            </Marker>
          );
        })}
      </MapView>

      {/* Legend when multiple stations are visible */}
      {stations.length > 1 && (
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
