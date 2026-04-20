import { View, Text, Image, Pressable, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { fetchTopSpecies } from '../../src/api/species';
import { useStationStore } from '../../src/stores/stationStore';
import type { Species } from '../../src/types/birdweather';

const PLACEHOLDER = 'https://placehold.co/48x48/e5e7eb/6b7280?text=🐦';

function SpeciesRow({ species }: { species: Species }) {
  return (
    <Pressable
      className="flex-row items-center gap-3 px-4 py-3 active:bg-gray-50"
      onPress={() => router.push(`/species/${species.id}`)}
    >
      <Image
        source={{ uri: species.imageUrl ?? PLACEHOLDER }}
        className="h-12 w-12 rounded-lg bg-gray-100"
        resizeMode="cover"
      />
      <View className="flex-1">
        <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
          {species.commonName}
        </Text>
        <Text className="text-xs italic text-gray-400" numberOfLines={1}>
          {species.scientificName}
        </Text>
      </View>
      <Text className="text-sm text-gray-500">{species.count.toLocaleString()}</Text>
    </Pressable>
  );
}

export default function SpeciesScreen() {
  const stationId = useStationStore((s) => s.stationId) ?? '';

  const { data: species, isLoading } = useQuery({
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
