import { View, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useApiAdapter } from '../hooks/useApiAdapter';
import { useStationStore } from '../stores/stationStore';
import { formatTime } from '../lib/formatDate';
import type { Detection } from '../types/birdweather';

/** Feed header: today's totals from the station's stats plus the latest detection. */
export default function TodayCard({ latest, timezone }: { latest?: Detection; timezone?: string }) {
  const adapter = useApiAdapter();
  const isConnected = useStationStore((s) => s.isConnected);
  // Same key as the Stats tab, so the two share one request.
  const { data: stats } = useQuery({
    queryKey: ['stats', adapter?.cacheKey],
    queryFn: () => adapter!.fetchStats(),
    enabled: !!adapter && isConnected,
  });

  return (
    <View className="mx-4 mt-2 mb-3 rounded-3xl bg-green-900 px-5 py-5">
      <Text className="text-[11px] font-bold uppercase tracking-widest text-gold-400">Today</Text>
      <View className="mt-2 flex-row items-end gap-6">
        <View>
          <Text className="text-4xl font-bold text-white">
            {stats ? stats.recordsToday.toLocaleString() : '–'}
          </Text>
          <Text className="text-xs text-green-200">detections</Text>
        </View>
        <View>
          <Text className="text-4xl font-bold text-white">
            {stats ? stats.uniqueSpecies.toLocaleString() : '–'}
          </Text>
          <Text className="text-xs text-green-200">species all time</Text>
        </View>
      </View>
      {latest ? (
        <View className="mt-4 flex-row items-center gap-2 rounded-2xl bg-green-800 px-3 py-2">
          <View className="h-2 w-2 rounded-full bg-gold-400" />
          <Text className="flex-1 text-sm text-green-50" numberOfLines={1}>
            Latest: <Text className="font-semibold text-white">{latest.commonName}</Text>
          </Text>
          <Text className="text-xs text-green-200">{formatTime(latest.timestamp, timezone)}</Text>
        </View>
      ) : null}
    </View>
  );
}
