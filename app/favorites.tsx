import { View, Text } from 'react-native';
import { useQueries } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { fetchSpecies } from '../src/api/species';
import { useFavoritesStore } from '../src/stores/favoritesStore';
import SpeciesRow from '../src/components/SpeciesRow';
import type { Species } from '../src/types/birdweather';

export default function FavoritesScreen() {
  const speciesIds = useFavoritesStore((s) => s.speciesIds);

  const results = useQueries({
    queries: speciesIds.map((id) => ({
      queryKey: ['species', id],
      queryFn: () => fetchSpecies(id),
      enabled: !!id,
    })),
  });

  const loaded = results
    .filter((r) => r.data)
    .map((r) => r.data as Species);

  return (
    <View className="flex-1 bg-white">
      <FlashList
        data={loaded}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SpeciesRow species={item} />}
        overrideItemLayout={(_layout, _item, _index) => ({ size: 68 })}
        ItemSeparatorComponent={() => <View className="h-px bg-gray-100 ml-16" />}
        ListEmptyComponent={() => (
          <View className="flex-1 items-center justify-center py-24 px-8">
            <Text className="text-center text-gray-400">
              No favorites yet. Star a species to see it here.
            </Text>
          </View>
        )}
      />
    </View>
  );
}
