import { View, Text, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { useStationStore } from '../../src/stores/stationStore';
import { useApiAdapter } from '../../src/hooks/useApiAdapter';
import SpeciesRow, { SPECIES_ROW_HEIGHT } from '../../src/components/SpeciesRow';
import ErrorState from '../../src/components/ErrorState';

export default function SpeciesScreen() {
  const isConnected = useStationStore((s) => s.isConnected);
  const adapter = useApiAdapter();

  const { data: species, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['topSpecies', adapter?.cacheKey, 200],
    queryFn: () => adapter!.fetchTopSpecies(200),
    enabled: !!adapter && isConnected,
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950">
        <ActivityIndicator size="large" color="#1D5339" />
      </View>
    );
  }

  if (isError) {
    return (
      <ErrorState
        error={error instanceof Error ? error : null}
        onRetry={refetch}
        subject="species"
      />
    );
  }

  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-950">
      <FlashList
        data={species ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SpeciesRow species={item} />}
        overrideItemLayout={(_layout, _item, _index) => ({ size: SPECIES_ROW_HEIGHT })}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 16 }}
        ListEmptyComponent={() => (
          <View className="flex-1 items-center justify-center py-24">
            <Text className="text-gray-400 dark:text-gray-500">No species detected yet.</Text>
          </View>
        )}
      />
    </View>
  );
}
