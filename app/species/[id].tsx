import { View, Text, Image, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fetchSpecies } from '../../src/api/species';
import { fetchRecordsForSpecies } from '../../src/api/records';
import { useStationStore } from '../../src/stores/stationStore';
import { useFavoritesStore } from '../../src/stores/favoritesStore';
import RecordCard from '../../src/components/RecordCard';

export default function SpeciesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stationId = useStationStore((s) => s.stationId) ?? '';
  const { has, toggle } = useFavoritesStore();

  const { data: species, isLoading } = useQuery({
    queryKey: ['species', id],
    queryFn: () => fetchSpecies(id),
    enabled: !!id,
  });

  const { data: recentRecords } = useQuery({
    queryKey: ['speciesRecords', stationId, id],
    queryFn: () => fetchRecordsForSpecies(stationId, id),
    enabled: !!stationId && !!id,
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
