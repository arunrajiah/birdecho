import { View, Text, Pressable, Linking, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useCellArrivals, useRegionDrift, useStationLocation } from '../hooks/useWildNetwork';
import { WILDNETWORK_BASE, formatWeek, regionFor, speciesUrl, type CellArrival } from '../lib/wildnetwork';

const RECENT_DAYS = 28;

function isRecent(week: string | null): boolean {
  if (!week) return false;
  return Date.now() - new Date(`${week}T00:00:00Z`).getTime() <= RECENT_DAYS * 24 * 60 * 60 * 1000;
}

function SpeciesLine({ name, sci, detail, heardHere }: { name: string; sci: string; detail: string; heardHere?: boolean }) {
  return (
    <Pressable
      className="flex-row items-center py-2 border-b border-gray-100 dark:border-gray-800 active:opacity-75"
      onPress={() => void Linking.openURL(speciesUrl(sci))}
    >
      <Text className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
        {name}
        {heardHere ? <Text className="text-xs font-normal text-green-700">{'  '}heard here</Text> : null}
      </Text>
      <Text className="text-xs text-gray-500 dark:text-gray-400">{detail}</Text>
    </Pressable>
  );
}

/**
 * "Near you on WildNetwork": seasonal arrivals and departures in the station's
 * 5-degree square and species moving within its continent.
 * `heardHere` holds scientific names this station has detected.
 */
export default function NearYouCard({ heardHere }: { heardHere: Set<string> }) {
  const loc = useStationLocation();
  const arrivals = useCellArrivals();
  const drift = useRegionDrift();

  if (!loc) {
    return (
      <View className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
        <Text className="mb-1 text-base font-semibold text-gray-800 dark:text-gray-200">Near you on WildNetwork</Text>
        <Text className="mb-3 text-sm text-gray-400 dark:text-gray-500">
          See which birds are arriving and leaving around your station. Set your station&apos;s
          approximate area first.
        </Text>
        <Pressable
          className="items-center rounded-xl border border-gray-200 dark:border-gray-700 py-3 active:opacity-75"
          onPress={() => router.push('/wildnetwork')}
        >
          <Text className="text-sm font-semibold text-gray-700 dark:text-gray-300">Set station area</Text>
        </Pressable>
      </View>
    );
  }

  const name = (a: { vernacularName: string | null; scientificName: string }) => a.vernacularName ?? a.scientificName;
  const rows = arrivals.data ?? [];
  const arrived = rows
    .filter((a) => isRecent(a.arrivalWeek) && !a.departureWeek)
    .sort((a, b) => (b.arrivalWeek ?? '').localeCompare(a.arrivalWeek ?? '') || b.detections - a.detections)
    .slice(0, 6);
  const leaving = rows
    .filter((a) => isRecent(a.departureWeek))
    .sort((a, b) => (b.departureWeek ?? '').localeCompare(a.departureWeek ?? '') || b.detections - a.detections)
    .slice(0, 4);
  const moving = (drift.data ?? []).slice(0, 3);
  const region = regionFor(loc.lat, loc.lon);

  const list = (title: string, items: CellArrival[], week: (a: CellArrival) => string | null) =>
    items.length > 0 ? (
      <View className="mb-3">
        <Text className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">{title}</Text>
        {items.map((a) => (
          <SpeciesLine
            key={a.scientificName}
            name={name(a)}
            sci={a.scientificName}
            detail={`week of ${formatWeek(week(a))}`}
            heardHere={heardHere.has(a.scientificName)}
          />
        ))}
      </View>
    ) : null;

  return (
    <View className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
      <Text className="mb-1 text-base font-semibold text-gray-800 dark:text-gray-200">Near you on WildNetwork</Text>
      <Text className="mb-3 text-sm text-gray-400 dark:text-gray-500">
        Across all stations in the 5 degree square around yours, effort corrected.
      </Text>

      {arrivals.isLoading ? <ActivityIndicator className="my-3" /> : null}
      {arrivals.isError ? (
        <Text className="mb-3 text-sm text-gray-400">WildNetwork is not reachable right now.</Text>
      ) : null}
      {list('Arrived in the last 4 weeks', arrived, (a) => a.arrivalWeek)}
      {list('Leaving', leaving, (a) => a.departureWeek)}
      {arrivals.isSuccess && arrived.length === 0 && leaving.length === 0 ? (
        <Text className="mb-3 text-sm text-gray-400">No arrivals or departures in your area in the last 4 weeks.</Text>
      ) : null}

      {moving.length > 0 ? (
        <View className="mb-3">
          <Text className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">Moving in {region}</Text>
          {moving.map((d) => (
            <SpeciesLine
              key={d.scientificName}
              name={name(d)}
              sci={d.scientificName}
              detail={`${Math.abs(d.driftDeg).toFixed(1)}° ${d.driftDeg < 0 ? 'south' : 'north'}`}
              heardHere={heardHere.has(d.scientificName)}
            />
          ))}
        </View>
      ) : null}

      <Pressable onPress={() => void Linking.openURL(WILDNETWORK_BASE)}>
        <Text className="text-sm font-medium text-green-700">Open the WildNetwork map</Text>
      </Pressable>
    </View>
  );
}
