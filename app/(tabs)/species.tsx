import { View, Text, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { fetchTopSpecies } from '../../src/api/species';
import { useStationStore } from '../../src/stores/stationStore';
import SpeciesRow from '../../src/components/SpeciesRow';
import ErrorState from '../../src/components/ErrorState';

export default function SpeciesScreen() {
  const stationId = useStationStore((s) => s.stationId) ?? '';

  const { data: species, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['topSpecies', stationId, 200],
    queryFn: () => fetchTopSpecies(stationId, 200),
    enabled: !!stationId,
  });

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
        subject="species"
      />
    );
  }

  return (
    <View className="flex-1 bg-white">
      <FlashList
        data={species ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SpeciesRow species={item} />}
        overrideItemLayout={(_layout, _item, _index) => ({ size: 68 })}
        ItemSeparatorComponent={() => <View className="h-px bg-gray-100 ml-16" />}
        ListEmptyComponent={() => (
          <View className="flex-1 items-center justify-center py-24">
            <Text className="text-gray-400">No species detected yet.</Text>
          </View>
        )}
      />
    </View>
  );
}
