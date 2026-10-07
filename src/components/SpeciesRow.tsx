import { useEffect, useState } from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { remoteImage } from '../lib/remoteImage';
import { router } from 'expo-router';
import type { Species } from '../types/birdweather';
import { useRareStore } from '../stores/rareStore';
import RareBadge from './RareBadge';

// M-5: Bundled local asset — no external network call for placeholder images.
const PLACEHOLDER = require('../../assets/icon.png') as number;

/** Fixed row height (image 48 + padding 24 + vertical margin 8) for FlashList layout. */
export const SPECIES_ROW_HEIGHT = 80;

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
      className="mx-4 my-1 flex-row items-center gap-3 rounded-2xl bg-white dark:bg-gray-900 p-3 active:opacity-80"
      onPress={() => router.push({ pathname: '/species/[id]', params: { id: species.id } })}
    >
      <Image
        source={species.imageUrl && !imgFailed ? remoteImage(species.imageUrl) : PLACEHOLDER}
        onError={() => setImgFailed(true)}
        className="h-12 w-12 rounded-xl bg-gray-100 dark:bg-gray-800"
        resizeMode="cover"
      />
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="shrink text-[15px] font-semibold text-gray-900 dark:text-gray-50" numberOfLines={1}>
            {species.commonName}
          </Text>
          {rare ? <RareBadge /> : null}
        </View>
        <Text className="mt-0.5 text-xs italic text-gray-500 dark:text-gray-400" numberOfLines={1}>
          {species.scientificName}
        </Text>
      </View>
      {species.count > 0 ? (
        <View className="rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1">
          <Text className="text-xs font-semibold text-gray-700 dark:text-gray-200">
            {species.count.toLocaleString()}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
