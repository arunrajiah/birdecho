import { View, Text, Image, Pressable } from 'react-native';
import { router } from 'expo-router';
import type { Species } from '../types/birdweather';

// M-5: Bundled local asset — no external network call for placeholder images.
const PLACEHOLDER = require('../../assets/icon.png') as number;

export default function SpeciesRow({ species }: { species: Species }) {
  return (
    <Pressable
      className="flex-row items-center gap-3 px-4 py-3 active:bg-gray-50"
      onPress={() => router.push(`/species/${species.id}`)}
    >
      <Image
        source={species.imageUrl ? { uri: species.imageUrl } : PLACEHOLDER}
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
