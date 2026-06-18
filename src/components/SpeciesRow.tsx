import { useState } from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { router } from 'expo-router';
import type { Species } from '../types/birdweather';
import RareBadge from './RareBadge';

// M-5: Bundled local asset — no external network call for placeholder images.
const PLACEHOLDER = require('../../assets/icon.png') as number;

export default function SpeciesRow({ species, rare = false }: { species: Species; rare?: boolean }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <Pressable
      className="flex-row items-center gap-3 px-4 py-3 active:bg-gray-50 dark:active:bg-gray-800"
      onPress={() => router.push(`/species/${species.id}`)}
    >
      <Image
        source={species.imageUrl && !imgFailed ? { uri: species.imageUrl } : PLACEHOLDER}
        onError={() => setImgFailed(true)}
        className="h-12 w-12 rounded-lg bg-gray-100 dark:bg-gray-800"
        resizeMode="cover"
      />
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="shrink text-sm font-semibold text-gray-900 dark:text-white" numberOfLines={1}>
            {species.commonName}
          </Text>
          {rare ? <RareBadge /> : null}
        </View>
        <Text className="text-xs italic text-gray-400 dark:text-gray-500" numberOfLines={1}>
          {species.scientificName}
        </Text>
      </View>
      <Text className="text-sm text-gray-500 dark:text-gray-400">
        {species.count > 0 ? species.count.toLocaleString() : '—'}
      </Text>
    </Pressable>
  );
}
