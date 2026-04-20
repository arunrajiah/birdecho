import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Audio } from 'expo-av';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import { fetchRecord } from '../../src/api/records';
import { useStationStore } from '../../src/stores/stationStore';

const { width } = Dimensions.get('window');

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'bg-green-500';
  if (confidence >= 0.5) return 'bg-amber-400';
  return 'bg-red-500';
}

export default function RecordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stationName = useStationStore((s) => s.stationName);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const cardRef = useRef<ViewShot>(null);
  const isMountedRef = useRef(true);

  const { data: record, isLoading, isError } = useQuery({
    queryKey: ['record', id],
    queryFn: () => fetchRecord(id),
    enabled: !!id,
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      sound?.unloadAsync();
    };
  }, [sound]);

  const togglePlay = useCallback(async () => {
    if (!record?.soundscapeUrl) return;
    if (sound) {
      if (playing) {
        await sound.pauseAsync();
        setPlaying(false);
      } else {
        await sound.playAsync();
        setPlaying(true);
      }
      return;
    }
    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri: record.soundscapeUrl },
      { shouldPlay: true },
    );
    if (!isMountedRef.current) {
      await newSound.unloadAsync();
      return;
    }
    newSound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) setPlaying(false);
    });
    setSound(newSound);
    setPlaying(true);
  }, [sound, playing, record]);

  const handleShare = useCallback(async () => {
    if (!cardRef.current?.capture) return;
    setShareError(null);
    try {
      const uri = await cardRef.current.capture();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png' });
      }
    } catch {
      setShareError('Could not share sighting. Please try again.');
    }
  }, []);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#15803d" />
      </View>
    );
  }

  if (isError || !record) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500">Could not load this sighting.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white">
      <ViewShot ref={cardRef} options={{ format: 'png', quality: 1 }}>
        <Image
          source={{ uri: record.imageUrl ?? `https://placehold.co/${Math.round(width)}x240/e5e7eb/6b7280?text=Bird` }}
          style={{ width, height: 240 }}
          resizeMode="cover"
        />
        <View className="px-5 py-4 gap-1">
          <Text className="text-2xl font-bold text-gray-900">{record.commonName}</Text>
          <Text className="text-base italic text-gray-400">{record.scientificName}</Text>
          <View className="mt-3 flex-row items-center gap-3">
            <View className={`rounded-full px-3 py-1 ${confidenceColor(record.confidence)}`}>
              <Text className="text-sm font-semibold text-white">
                {Math.round(record.confidence * 100)}% confidence
              </Text>
            </View>
          </View>
          <Text className="mt-2 text-sm text-gray-400">
            {new Date(record.timestamp).toLocaleString()}
          </Text>
          {stationName ? <Text className="text-sm text-gray-400">{stationName}</Text> : null}
        </View>
      </ViewShot>

      <View className="px-5 pb-6 gap-3">
        {record.soundscapeUrl ? (
          <Pressable
            className="flex-row items-center justify-center gap-2 rounded-xl bg-green-700 py-3 active:opacity-75"
            onPress={togglePlay}
          >
            <Text className="text-base font-semibold text-white">
              {playing ? '⏸ Pause' : '▶ Play recording'}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          className="flex-row items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 active:opacity-75"
          onPress={handleShare}
        >
          <Text className="text-base font-semibold text-gray-700">Share sighting</Text>
        </Pressable>
        {shareError ? (
          <Text className="text-center text-sm text-red-600">{shareError}</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}
