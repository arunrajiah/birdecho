import { useEffect, useState } from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { router } from 'expo-router';
import type { Species } from '../types/birdweather';
import { useRareStore } from '../stores/rareStore';
import RareBadge from './RareBadge';

// M-5: Bundled local asset — no external network call for placeholder images.
const PLACEHOLDER = require('../../assets/icon.png') as number;

export default function SpeciesRow({ species }: { species: Species }) {
  const [imgFailed, setImgFailed] = useState(false);
  // Rarity is user-defined (issue #24): badge shows only for species the user
  // has marked rare on the detail screen.
  const rare = useRareStore((s) => s.speciesIds.includes(species.id));
  // FlashList recycles row instances; reset the failure flag when the image
  // changes so a recycled row doesn't keep showing the placeholder (or a stale
  // broken image) from the previous species.
  useEffect(() => setImgFailed(false), [species.imageUrl]);
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
