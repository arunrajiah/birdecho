import { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { remoteImage } from '../../src/lib/remoteImage';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useApiAdapter } from '../../src/hooks/useApiAdapter';
import { useFavoritesStore } from '../../src/stores/favoritesStore';
import { useRareStore } from '../../src/stores/rareStore';
import RecordCard from '../../src/components/RecordCard';
import RareBadge from '../../src/components/RareBadge';
import SeasonLine from '../../src/components/SeasonLine';

export default function SpeciesDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const adapter = useApiAdapter();
  const { has, toggle } = useFavoritesStore();
  const toggleRare = useRareStore((s) => s.toggle);
  const rare = useRareStore((s) => s.speciesIds.includes(id));

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
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => setImgFailed(false), [species?.imageUrl]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950">
        <ActivityIndicator size="large" color="#1D5339" />
      </View>
    );
  }

  if (!species) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Text className="text-gray-500 dark:text-gray-400">Species not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-950" contentContainerStyle={{ paddingBottom: 24 }}>
      {species.imageUrl && !imgFailed ? (
        <View className="px-4 pt-2">
          <Image
            source={remoteImage(species.imageUrl)}
            onError={() => setImgFailed(true)}
            className="h-60 w-full rounded-3xl bg-gray-200 dark:bg-gray-800"
            resizeMode="cover"
          />
        </View>
      ) : null}

      <View className="px-4 pt-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 mr-4">
            <View className="flex-row items-center gap-2">
              <Text className="shrink text-[28px] font-bold leading-tight text-gray-900 dark:text-gray-50">{species.commonName}</Text>
              {rare ? <RareBadge /> : null}
            </View>
            <Text className="mt-0.5 text-base italic text-gray-500 dark:text-gray-400">{species.scientificName}</Text>
          </View>
          <Pressable
            className="mt-1 h-11 w-11 items-center justify-center rounded-full bg-white dark:bg-gray-900 active:opacity-75"
            onPress={() => toggle(id)}
          >
            <Text className={`text-2xl ${favorited ? 'text-gold-500' : 'text-gray-400'}`}>{favorited ? '★' : '☆'}</Text>
          </Pressable>
        </View>

        <View className="mt-4 flex-row items-center gap-2">
          <View className="rounded-full bg-green-100 dark:bg-green-900 px-3 py-1.5">
            <Text className="text-sm font-semibold text-green-800 dark:text-green-200">
              {species.count.toLocaleString()} detections here
            </Text>
          </View>
          {/* User-defined rarity (issue #24). Marked species show the Rare badge and,
              when rare-species alerts are enabled, trigger a notification on detection. */}
          <Pressable
            onPress={() => toggleRare(id)}
            className={`flex-row items-center rounded-full px-3 py-1.5 active:opacity-75 ${
              rare ? 'bg-amber-100 dark:bg-amber-950' : 'bg-white dark:bg-gray-900'
            }`}
          >
            <Text className={`text-sm font-medium ${rare ? 'text-amber-800 dark:text-amber-300' : 'text-gray-600 dark:text-gray-300'}`}>
              {rare ? '⚑  Marked as rare' : '⚑  Mark as rare'}
            </Text>
          </Pressable>
        </View>

        <SeasonLine scientificName={species.scientificName} />
      </View>

      {recentRecords && recentRecords.length > 0 ? (
        <View className="mt-6">
          <Text className="mx-5 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Recent sightings
          </Text>
          {recentRecords.map((r) => (
            <RecordCard key={r.id} record={r} />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
