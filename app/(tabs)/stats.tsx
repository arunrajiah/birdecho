import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { VictoryBar, VictoryChart, VictoryAxis } from 'victory-native';
import { fetchStats, fetchDailyCounts } from '../../src/api/stats';
import { fetchTopSpecies } from '../../src/api/species';
import { useStationStore } from '../../src/stores/stationStore';
import ErrorState from '../../src/components/ErrorState';

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <View className="flex-1 items-center rounded-xl bg-green-50 py-4">
      <Text className="text-2xl font-bold text-green-800">{value}</Text>
      <Text className="mt-1 text-xs text-gray-500 text-center">{label}</Text>
    </View>
  );
}

export default function StatsScreen() {
  const stationId = useStationStore((s) => s.stationId) ?? '';

  const { data: stats, isLoading: statsLoading, isError: statsError, error: statsQueryError, refetch } = useQuery({
    queryKey: ['stats', stationId],
    queryFn: () => fetchStats(stationId),
    enabled: !!stationId,
  });

  const { data: daily } = useQuery({
    queryKey: ['daily', stationId],
    queryFn: () => fetchDailyCounts(stationId, 14),
    enabled: !!stationId,
  });

  const { data: topSpecies } = useQuery({
    queryKey: ['topSpecies', stationId, 10],
    queryFn: () => fetchTopSpecies(stationId, 10),
    enabled: !!stationId,
  });

  if (statsLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#15803d" />
      </View>
    );
  }

  if (statsError || !stats) {
    return (
      <ErrorState
        error={statsQueryError instanceof Error ? statsQueryError : null}
        onRetry={refetch}
        subject="station stats"
      />
    );
  }

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-4 pt-6 pb-4">
        <Text className="mb-4 text-xl font-bold text-gray-900">Station stats</Text>

        <View className="flex-row gap-3">
          <StatCard label="Total records" value={stats.totalRecords.toLocaleString()} />
          <StatCard label="Unique species" value={stats.uniqueSpecies} />
          <StatCard label="Today" value={stats.recordsToday} />
        </View>

        {daily && daily.length > 0 ? (
          <View className="mt-6">
            <Text className="mb-2 text-base font-semibold text-gray-800">Last 14 days</Text>
            <VictoryChart height={200} padding={{ top: 10, bottom: 40, left: 50, right: 20 }}>
              <VictoryAxis
                tickFormat={(t: string) => t.slice(5)}
                tickCount={4}
                style={{ tickLabels: { fontSize: 9, fill: '#9ca3af' } }}
              />
              <VictoryAxis dependentAxis style={{ tickLabels: { fontSize: 9, fill: '#9ca3af' } }} />
              <VictoryBar
                data={daily}
                x="date"
                y="count"
                style={{ data: { fill: '#15803d' } }}
                cornerRadius={{ top: 3 }}
              />
            </VictoryChart>
          </View>
        ) : null}

        {topSpecies && topSpecies.length > 0 ? (
          <View className="mt-4">
            <Text className="mb-3 text-base font-semibold text-gray-800">Top species</Text>
            {topSpecies.map((sp, i) => (
              <View key={sp.id} className="flex-row items-center py-2 border-b border-gray-100">
                <Text className="w-7 text-sm text-gray-400">{i + 1}.</Text>
                <Text className="flex-1 text-sm font-medium text-gray-900">{sp.commonName}</Text>
                <Text className="text-sm text-gray-500">{sp.count.toLocaleString()}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
