import { View, Text, Image, Pressable } from 'react-native';
import { useQueries } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { fetchSpecies } from '../../src/api/species';
import { useFavoritesStore } from '../../src/stores/favoritesStore';
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
