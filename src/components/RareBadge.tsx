import { View, Text } from 'react-native';

/**
 * Small "RARE" pill shown next to species the user has marked as rare on the
 * species detail screen (see src/stores/rareStore.ts).
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
