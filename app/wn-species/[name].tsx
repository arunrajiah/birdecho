import { View, Text, Image, ScrollView, ActivityIndicator, Pressable, Linking } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { remoteImage } from '../../src/lib/remoteImage';
import { WILDNETWORK_BASE, fetchSpeciesSummary, speciesUrl } from '../../src/lib/wildnetwork';
import SeasonLine from '../../src/components/SeasonLine';

/**
 * A Wildlife Network species page inside the app, opened from "Near you" (most of those species are not heard
 * by the user's own station, so the station's species page does not apply). The website is one tap away.
 */
export default function WildNetworkSpeciesScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['wildnetwork', 'species', name],
    queryFn: () => fetchSpeciesSummary(name),
    enabled: !!name,
    staleTime: 6 * 60 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950">
        <ActivityIndicator color="#347F57" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-950" contentContainerStyle={{ paddingBottom: 32 }}>
      {data?.imageUrl ? (
        <View className="px-4 pt-2">
          <Image source={remoteImage(data.imageUrl)} className="h-60 w-full rounded-3xl bg-gray-200 dark:bg-gray-800" resizeMode="cover" accessibilityIgnoresInvertColors />
        </View>
      ) : null}
      <View className="px-4 pt-4">
        <Text className="text-[28px] font-bold leading-tight text-gray-900 dark:text-gray-50">{data?.vernacularName ?? name}</Text>
        <Text className="mt-0.5 text-base italic text-gray-500 dark:text-gray-400">{name}</Text>
        {isError ? (
          <Text className="mt-4 text-sm text-gray-600 dark:text-gray-300">Wildlife Network is not reachable right now.</Text>
        ) : null}
        {data?.story?.length ? (
          <View className="mt-4 rounded-2xl bg-white dark:bg-gray-900 px-4 py-3.5">
            <Text className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">What is changing</Text>
            {data.story.map((line) => (
              <Text key={line} className="mt-1.5 text-sm text-gray-700 dark:text-gray-200">{line}</Text>
            ))}
          </View>
        ) : null}
        <SeasonLine scientificName={name} hideLink />
        {data?.extract ? <Text className="mt-4 text-sm leading-5 text-gray-600 dark:text-gray-300">{data.extract}</Text> : null}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Open this species on the Wildlife Network website"
          className="mt-5 flex-row items-center gap-1.5 self-start"
          onPress={() => void Linking.openURL(speciesUrl(name))}
        >
          <Text className="text-sm font-semibold text-green-700 dark:text-green-300">Map and movement on {WILDNETWORK_BASE.replace('https://', '')}</Text>
          <Ionicons name="open-outline" size={14} color="#347F57" />
        </Pressable>
      </View>
    </ScrollView>
  );
}
