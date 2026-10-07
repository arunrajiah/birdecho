import { View, Text, Pressable, Linking } from 'react-native';
import { useCellArrivals } from '../hooks/useWildNetwork';
import { formatWeek, isSolidArrival, speciesUrl } from '../lib/wildnetwork';

/** One species' seasonal timing in the station's 5-degree square, from WildNetwork. */
export default function SeasonLine({ scientificName }: { scientificName: string }) {
  const { data } = useCellArrivals();
  // Weak seasons (likely misdetections) are left out rather than shown as fact.
  const row = data?.find((a) => a.scientificName === scientificName && isSolidArrival(a));
  const parts = row
    ? [
        row.arrivalWeek && `arrived week of ${formatWeek(row.arrivalWeek)}`,
        row.peakWeek && `peak week of ${formatWeek(row.peakWeek)}`,
        row.departureWeek && `left week of ${formatWeek(row.departureWeek)}`,
      ].filter(Boolean)
    : [];

  return (
    <View className="mt-4 rounded-2xl bg-white dark:bg-gray-900 px-4 py-3.5">
      <Text className="ml-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">In your area</Text>
      {parts.length > 0 ? (
        <Text className="mt-1 text-sm text-gray-700 dark:text-gray-200">
          This season around your station it {parts.join(', ')}.
        </Text>
      ) : null}
      <Pressable className="mt-1" onPress={() => void Linking.openURL(speciesUrl(scientificName))}>
        <Text className="text-sm font-semibold text-green-700 dark:text-green-300">See its movement on WildNetwork</Text>
      </Pressable>
    </View>
  );
}
