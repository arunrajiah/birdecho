import { View, Text, Image, Pressable } from 'react-native';
import { router } from 'expo-router';
import type { Detection } from '../types/birdweather';

const PLACEHOLDER = 'https://placehold.co/56x56/e5e7eb/6b7280?text=🐦';

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'bg-green-500';
  if (confidence >= 0.5) return 'bg-amber-400';
  return 'bg-red-500';
}

interface Props {
  record: Detection;
}

export default function RecordCard({ record }: Props) {
  return (
    <Pressable
      className="flex-row items-center gap-3 bg-white px-4 py-3 active:bg-gray-50"
      onPress={() => router.push(`/record/${record.id}`)}
    >
      <Image
        source={{ uri: record.imageUrl ?? PLACEHOLDER }}
        className="h-14 w-14 rounded-lg bg-gray-100"
        resizeMode="cover"
      />
      <View className="flex-1">
        <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
          {record.commonName}
        </Text>
        <Text className="text-sm italic text-gray-400" numberOfLines={1}>
          {record.scientificName}
        </Text>
      </View>
      <View className="items-end gap-1">
        <Text className="text-xs text-gray-400">
          {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <View className={`rounded-full px-2 py-0.5 ${confidenceColor(record.confidence)}`}>
          <Text className="text-xs font-medium text-white">
            {Math.round(record.confidence * 100)}%
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
