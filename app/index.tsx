import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Image, Linking } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { useStationStore } from '../src/stores/stationStore';
import { getBases } from '../src/lib/secureStorage';
import { startRoute } from '../src/lib/baseStation';
import { TUTORIAL_VIDEO_URL } from '../src/lib/links';

export default function HomeScreen() {
  // Use isConnected (covers both BirdWeather and BirdNET-Go) instead of stationId
  // which is only set for BirdWeather connections.
  const isConnected = useStationStore((s) => s.isConnected);
  const loading = useStationStore((s) => s.loading);
  const stationName = useStationStore((s) => s.stationName);
  const disconnect = useStationStore((s) => s.disconnect);
  const navigation = useNavigation();
  // Bases saved on this phone keep the app open even with no station (null while reading).
  const [baseCount, setBaseCount] = useState<number | null>(null);
  useEffect(() => {
    void getBases().then((b) => setBaseCount(b.length));
  }, [isConnected]);

  // Auto-navigate once the store has hydrated: the Feed with a station, Settings when only Bases are saved.
  // This avoids the user having to tap "View recent sightings" every time they open the app. Only while this
  // screen is in front, so a flow pushed on top (Add a Base, Connect) is not replaced when it adds a station.
  useEffect(() => {
    if (loading || baseCount === null || !navigation.isFocused()) return;
    const route = startRoute(isConnected, baseCount);
    if (route === 'feed') router.replace('/(tabs)');
    else if (route === 'settings') router.replace('/(tabs)/settings');
  }, [loading, isConnected, baseCount, navigation]);

  if (loading || baseCount === null) {
    return (
      <View className="flex-1 items-center justify-center bg-green-900">
        <ActivityIndicator size="large" color="#C8A94C" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-green-900 px-6">
      <View className="flex-1 items-center justify-center">
        <Image source={require('../assets/icon.png')} className="h-24 w-24 rounded-3xl" />
        <Text className="mt-6 text-4xl font-bold text-white">BirdEcho</Text>
        <Text className="mt-2 text-base text-green-200 text-center">
          Your backyard bird station, on your phone.
        </Text>
        {isConnected ? (
          <Text className="mt-6 text-sm font-semibold uppercase tracking-widest text-gold-400">
            {stationName ?? '—'}
          </Text>
        ) : null}
      </View>

      <View className="pb-12">
        {isConnected ? (
          <>
            <Pressable
              className="items-center rounded-2xl bg-gold-500 py-4 active:opacity-80"
              onPress={() => router.replace('/(tabs)')}
            >
              <Text className="text-base font-bold text-green-950">View recent sightings</Text>
            </Pressable>
            <Pressable className="mt-3 items-center py-2 active:opacity-75" onPress={() => disconnect()}>
              <Text className="text-sm text-green-200">Disconnect</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            className="items-center rounded-2xl bg-gold-500 py-4 active:opacity-80"
            onPress={() => router.push('/onboarding')}
          >
            <Text className="text-base font-bold text-green-950">Connect your station</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="link"
          className="mt-3 items-center py-2 active:opacity-75"
          onPress={() => Linking.openURL(TUTORIAL_VIDEO_URL)}
        >
          <Text className="text-sm text-green-200">New here? Watch the 6 minute video guide</Text>
        </Pressable>
      </View>
    </View>
  );
}
