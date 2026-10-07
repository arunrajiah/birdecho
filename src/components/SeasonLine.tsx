import { View, Text, Pressable, Linking } from 'react-native';
import { useCellArrivals } from '../hooks/useWildNetwork';
import { formatWeek, speciesUrl } from '../lib/wildnetwork';

/** One species' seasonal timing in the station's 5-degree square, from WildNetwork. */
export default function SeasonLine({ scientificName }: { scientificName: string }) {
  const { data } = useCellArrivals();
  const row = data?.find((a) => a.scientificName === scientificName);
  const parts = row
    ? [
        row.arrivalWeek && `arrived week of ${formatWeek(row.arrivalWeek)}`,
        row.peakWeek && `peak week of ${formatWeek(row.peakWeek)}`,
        row.departureWeek && `left week of ${formatWeek(row.departureWeek)}`,
      ].filter(Boolean)
    : [];

  return (
    <View className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
      <Text className="text-xs font-medium uppercase tracking-wide text-gray-400">In your area</Text>
      {parts.length > 0 ? (
        <Text className="mt-1 text-sm text-gray-700">
          This season around your station it {parts.join(', ')}.
        </Text>
      ) : null}
      <Pressable className="mt-1" onPress={() => void Linking.openURL(speciesUrl(scientificName))}>
        <Text className="text-sm font-medium text-green-700">See its movement on WildNetwork</Text>
      </Pressable>
    </View>
  );
}
