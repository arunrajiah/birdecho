import { View, Text, Image, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useApiAdapter } from '../../src/hooks/useApiAdapter';
import { useFavoritesStore } from '../../src/stores/favoritesStore';
import RecordCard from '../../src/components/RecordCard';

export default function SpeciesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const adapter = useApiAdapter();
  const { has, toggle } = useFavoritesStore();

  const { data: species, isLoading } = useQuery({
    queryKey: [adapter?.cacheKey, 'species', id],
    queryFn: () => adapter!.fetchSpecies(id!),
    enabled: !!adapter && !!id,
  });

  const { data: recentRecords } = useQuery({
    queryKey: [adapter?.cacheKey, 'speciesRecords', id],
    queryFn: () => adapter!.fetchRecordsForSpecies(id!),
    enabled: !!adapter && !!id,
  });

  const favorited = has(id);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#15803d" />
      </View>
    );
  }

  if (!species) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500">Species not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white">
      {species.imageUrl ? (
        <Image source={{ uri: species.imageUrl }} className="h-52 w-full bg-gray-100" resizeMode="cover" />
      ) : null}

      <View className="px-5 pt-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-4">
            <Text className="text-2xl font-bold text-gray-900">{species.commonName}</Text>
            <Text className="text-base italic text-gray-400">{species.scientificName}</Text>
          </View>
          <Pressable
            className="mt-1 h-10 w-10 items-center justify-center rounded-full active:opacity-75"
            onPress={() => toggle(id)}
          >
            <Text className="text-2xl">{favorited ? '★' : '☆'}</Text>
          </Pressable>
        </View>

        <Text className="mt-3 text-sm text-gray-500">
          {species.count.toLocaleString()} detections at this station
        </Text>

        {recentRecords && recentRecords.length > 0 ? (
          <View className="mt-5">
            <Text className="mb-2 text-base font-semibold text-gray-800">Recent sightings</Text>
            {recentRecords.map((r) => (
              <RecordCard key={r.id} record={r} />
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
