import { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { VictoryBar, VictoryChart, VictoryAxis } from 'victory-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useStationStore } from '../../src/stores/stationStore';
import { useApiAdapter } from '../../src/hooks/useApiAdapter';
import ErrorState from '../../src/components/ErrorState';

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <View className="flex-1 items-center rounded-xl bg-green-50 py-4">
      <Text className="text-2xl font-bold text-green-800">{value}</Text>
      <Text className="mt-1 text-xs text-gray-500 text-center">{label}</Text>
    </View>
  );
}

// ─── CSV export helpers ───────────────────────────────────────────────────────

function escapeCsvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function recordsToCsv(records: { id: string; commonName: string; scientificName: string; timestamp: string; confidence: number }[]): string {
  const header = 'id,common_name,scientific_name,timestamp,confidence_pct\n';
  const rows = records.map((r) =>
    [
      escapeCsvCell(r.id),
      escapeCsvCell(r.commonName),
      escapeCsvCell(r.scientificName),
      escapeCsvCell(r.timestamp),
      String(Math.round(r.confidence * 100)),
    ].join(','),
  );
  return header + rows.join('\n');
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const isConnected = useStationStore((s) => s.isConnected);
  const stationName = useStationStore((s) => s.stationName);
  const adapter = useApiAdapter();

  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    error: statsQueryError,
    refetch,
  } = useQuery({
    queryKey: ['stats', adapter?.cacheKey],
    queryFn: () => adapter!.fetchStats(),
    enabled: !!adapter && isConnected,
  });

  const { data: daily } = useQuery({
    queryKey: ['daily', adapter?.cacheKey],
    queryFn: () => adapter!.fetchDailyCounts(14),
    enabled: !!adapter && isConnected,
  });

  const { data: topSpecies } = useQuery({
    queryKey: ['topSpecies', adapter?.cacheKey, 10],
    queryFn: () => adapter!.fetchTopSpecies(10),
    enabled: !!adapter && isConnected,
  });

  // The feed query is already cached (populated by the Feed tab's 60-second
  // poll).  Re-using it here means the export button works without an extra
  // network call when the Feed tab has been visited.
  const { data: feedData } = useInfiniteQuery({
    queryKey: ['records', adapter?.cacheKey],
    queryFn: ({ pageParam }) => adapter!.fetchRecentRecords(pageParam as string | undefined),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!adapter && isConnected,
    staleTime: Infinity, // Only use what's already cached — don't re-fetch just for export
  });

  const handleExport = useCallback(async () => {
    setExportError(null);
    setExportLoading(true);
    try {
      const records = feedData?.pages.flatMap((p) => p.records) ?? [];
      if (!records.length) {
        setExportError('No detections to export yet. Pull-to-refresh the feed first.');
        return;
      }

      const csv = recordsToCsv(records);
      const slug = (stationName ?? 'birdecho').toLowerCase().replace(/[^a-z0-9]/g, '-');
      const ts = new Date().toISOString().slice(0, 10);
      const filename = `${slug}-detections-${ts}.csv`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `Export detections from ${stationName ?? 'station'}`,
        });
      } else {
        setExportError('Sharing is not available on this device.');
      }
    } catch {
      setExportError('Could not export detections. Please try again.');
    } finally {
      setExportLoading(false);
    }
  }, [feedData, stationName]);

  // ── Loading / error states ────────────────────────────────────────────────

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

  // ── Main content ──────────────────────────────────────────────────────────

  const recordCount = feedData?.pages.flatMap((p) => p.records).length ?? 0;

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-4 pt-6 pb-4">
        <Text className="mb-4 text-xl font-bold text-gray-900">Station stats</Text>

        {/* Headline numbers */}
        <View className="flex-row gap-3">
          <StatCard label="Total records" value={stats.totalRecords.toLocaleString()} />
          <StatCard label="Unique species" value={stats.uniqueSpecies} />
          <StatCard label="Today" value={stats.recordsToday} />
        </View>

        {/* 14-day bar chart */}
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

        {/* Top species */}
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

        {/* CSV export */}
        <View className="mt-6 pt-4 border-t border-gray-100">
          <Text className="mb-1 text-base font-semibold text-gray-800">Export</Text>
          <Text className="mb-3 text-sm text-gray-400">
            {recordCount > 0
              ? `${recordCount.toLocaleString()} detection${recordCount === 1 ? '' : 's'} loaded — exports the current feed page as CSV.`
              : 'Visit the Feed tab to load detections, then export here.'}
          </Text>
          <Pressable
            className="flex-row items-center justify-center rounded-xl border border-gray-200 py-3 active:opacity-75 disabled:opacity-50"
            onPress={handleExport}
            disabled={exportLoading || recordCount === 0}
          >
            {exportLoading ? (
              <ActivityIndicator color="#4b5563" size="small" />
            ) : (
              <Text className="text-sm font-semibold text-gray-700">
                Export detections as CSV
              </Text>
            )}
          </Pressable>
          {exportError ? (
            <Text className="mt-2 text-xs text-red-600 text-center">{exportError}</Text>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}
