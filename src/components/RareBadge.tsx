import { View, Text } from 'react-native';

/**
 * Small "RARE" pill shown next to species that are infrequently detected at the
 * connected station. See src/lib/rarity.ts for the rarity definition.
 */
export default function RareBadge() {
  return (
    <View className="rounded-full bg-amber-100 dark:bg-amber-900 px-2 py-0.5">
      <Text className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
        Rare
      </Text>
    </View>
  );
}
