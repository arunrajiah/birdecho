import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, View, Text, ActivityIndicator } from 'react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { requestWidgetUpdate } from 'react-native-android-widget';
import RecordCard from '../../src/components/RecordCard';
import ErrorState from '../../src/components/ErrorState';
import { useStationStore } from '../../src/stores/stationStore';
import { useFavoritesStore } from '../../src/stores/favoritesStore';
import { useApiAdapter } from '../../src/hooks/useApiAdapter';
import { scheduleLocalNotification } from '../../src/lib/notifications';
import { saveWidgetData, WIDGET_NAME } from '../../src/widgetTaskHandler';
import { BirdStationWidget } from '../../src/widgets/BirdStationWidget';
import type { Detection } from '../../src/types/birdweather';

const DAY_MS = 24 * 60 * 60 * 1000;

export default function FeedScreen() {
  const isConnected = useStationStore((s) => s.isConnected);
  const stationName = useStationStore((s) => s.stationName);
  const stationTimezone = useStationStore((s) => s.stationTimezone) ?? undefined;
  const queryClient = useQueryClient();
  const favSpeciesIds = useFavoritesStore((s) => s.speciesIds);
  const lastNotifiedRef = useRef<Record<string, number>>({});
  const adapter = useApiAdapter();

  useEffect(() => {
    lastNotifiedRef.current = {};
  }, [adapter?.cacheKey]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['records', adapter?.cacheKey],
    queryFn: ({ pageParam }) => adapter!.fetchRecentRecords(pageParam as string | undefined),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!adapter && isConnected,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const records = useMemo<Detection[]>(
    () => data?.pages.flatMap((p) => p.records) ?? [],
    [data],
  );

  // ─── Favourites local notifications ─────────────────────────────────────
  useEffect(() => {
    if (!records.length) return;
    const now = Date.now();
    records.forEach((r) => {
      if (!favSpeciesIds.includes(r.speciesId)) return;
      const last = lastNotifiedRef.current[r.speciesId] ?? 0;
      if (now - last < DAY_MS) return;
      lastNotifiedRef.current[r.speciesId] = now;
      scheduleLocalNotification(r.commonName, 'Seen at your station just now.');
    });
  }, [records, favSpeciesIds]);

  // ─── Home-screen widget update (Android only) ────────────────────────────
  //
  // After every successful feed poll (60 s interval) we:
  //   1. Persist the latest widget state to AsyncStorage so the widget task
  //      handler can read it when the app is killed (Android 30-min updates).
  //   2. Push a live update to every widget instance already on the home screen.
  //
  // `react-native-android-widget` is already a static dependency of this bundle
  // (imported via widgetTaskHandler), so the top-level imports carry no cost on
  // iOS/web beyond a module-level no-op.  The Platform guard prevents any call
  // at runtime on non-Android platforms.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!records.length || !stationName) return;

    const first = records[0]!;

    const ts = new Date(first.timestamp);
    // Simple HH:MM local time — no heavy timezone helper needed in the widget.
    const timeStr = ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Approximate today's count by matching the calendar date of the first record.
    const todayStr = ts.toDateString();
    const todayCount = records.filter(
      (r) => new Date(r.timestamp).toDateString() === todayStr,
    ).length;

    const widgetData = {
      stationName,
      lastSpecies: first.commonName,
      lastTimestamp: timeStr,
      detectionCount: todayCount,
    };

    void (async () => {
      // Persist for background/headless task handler reads.
      await saveWidgetData(widgetData);

      // Push live update to all home-screen instances.
      await requestWidgetUpdate({
        widgetName: WIDGET_NAME,
        renderWidget: () => <BirdStationWidget {...widgetData} />,
      });
    })();
  // records identity changes on every successful poll — that is the correct
  // trigger.  stationName never changes mid-session; omitting it from deps
  // would silence a legit ESLint warning, so include it explicitly.
  }, [records, stationName]);

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['records', adapter?.cacheKey] });
  }, [queryClient, adapter?.cacheKey]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#15803d" />
      </View>
    );
  }

  if (isError) {
    return (
      <ErrorState
        error={error instanceof Error ? error : null}
        onRetry={refetch}
        subject="sightings"
      />
    );
  }

  return (
    <View className="flex-1 bg-white">
      <FlashList
        data={records}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <RecordCard record={item} timezone={stationTimezone} />}
        overrideItemLayout={(_layout, _item, _index) => ({ size: 80 })}
        onRefresh={onRefresh}
        refreshing={isRefetching}
        onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
        onEndReachedThreshold={0.3}
        ItemSeparatorComponent={() => <View className="h-px bg-gray-100 ml-20" />}
        ListEmptyComponent={() => (
          <View className="flex-1 items-center justify-center py-24">
            <Text className="text-center text-base text-gray-400">
              No recent sightings from your station yet.
            </Text>
          </View>
        )}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="py-4">
              <ActivityIndicator color="#15803d" />
            </View>
          ) : null
        }
      />
    </View>
  );
}
