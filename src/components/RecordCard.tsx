import { useEffect, useState } from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { remoteImage } from '../lib/remoteImage';
import { router } from 'expo-router';
import type { Detection } from '../types/birdweather';
import { formatTime } from '../lib/formatDate';

// M-5: Use a bundled local asset instead of fetching from placehold.co (third-party, leaks IP).
const PLACEHOLDER = require('../../assets/icon.png') as number;

/** Tinted confidence chip: readable in both themes, quieter than a solid fill. */
function confidenceChip(confidence: number): { box: string; text: string } {
  if (confidence >= 0.8) return { box: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200' };
  if (confidence >= 0.5) return { box: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-800 dark:text-amber-300' };
  return { box: 'bg-red-100 dark:bg-red-950', text: 'text-red-700 dark:text-red-300' };
}

/** Fixed card height (image 56 + padding 24 + vertical margin 8) for FlashList layout. */
export const RECORD_CARD_HEIGHT = 88;

interface Props {
  record: Detection;
  /** IANA timezone string from the connected station, e.g. "America/New_York" */
  timezone?: string;
}

export default function RecordCard({ record, timezone }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  // FlashList recycles cards; reset on image change (see SpeciesRow).
  useEffect(() => setImgFailed(false), [record.imageUrl]);
  const chip = confidenceChip(record.confidence);
  return (
    <Pressable
      className="mx-4 my-1 flex-row items-center gap-3 rounded-2xl bg-white dark:bg-gray-900 p-3 active:opacity-80"
      onPress={() => router.push({ pathname: '/record/[id]', params: { id: record.id } })}
    >
      <Image
        source={record.imageUrl && !imgFailed ? remoteImage(record.imageUrl) : PLACEHOLDER}
        onError={() => setImgFailed(true)}
        className="h-14 w-14 rounded-xl bg-gray-100 dark:bg-gray-800"
        resizeMode="cover"
      />
      <View className="flex-1">
        <Text className="text-[15px] font-semibold text-gray-900 dark:text-gray-50" numberOfLines={1}>
          {record.commonName}
        </Text>
        <Text className="mt-0.5 text-xs italic text-gray-500 dark:text-gray-400" numberOfLines={1}>
          {record.scientificName}
        </Text>
      </View>
      <View className="items-end gap-1.5">
        <Text className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {formatTime(record.timestamp, timezone)}
        </Text>
        <View className={`rounded-full px-2 py-0.5 ${chip.box}`}>
          <Text className={`text-[11px] font-semibold ${chip.text}`}>
            {Math.round(record.confidence * 100)}%
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
