import { useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import RecordCard from '../src/components/RecordCard';
import { fetchRecentRecords } from '../src/api/records';
import { useStationStore } from '../src/stores/stationStore';
import type { Detection } from '../src/types/birdweather';

export default function FeedScreen() {
  const stationId = useStationStore((s) => s.stationId) ?? '';
  const queryClient = useQueryClient();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['records', stationId],
    queryFn: ({ pageParam }) =>
      fetchRecentRecords(stationId, pageParam as string | undefined),
    getNextPageParam: (lastPage) => lastPage.cursor,
    initialPageParam: undefined as string | undefined,
    enabled: !!stationId,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const records: Detection[] = data?.pages.flatMap((p) => p.records) ?? [];

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['records', stationId] });
  }, [queryClient, stationId]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#15803d" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center bg-white gap-4 px-6">
        <Text className="text-center text-base text-gray-600">
          Could not load sightings. Check your connection and station settings.
        </Text>
        <Pressable
          className="rounded-xl bg-green-700 px-6 py-3 active:opacity-75"
          onPress={() => refetch()}
        >
          <Text className="font-semibold text-white">Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <FlashList
        data={records}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <RecordCard record={item} />}
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
