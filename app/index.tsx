import { useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, Image } from 'react-native';
import { router } from 'expo-router';
import { useStationStore } from '../src/stores/stationStore';

export default function HomeScreen() {
  // Use isConnected (covers both BirdWeather and BirdNET-Go) instead of stationId
  // which is only set for BirdWeather connections.
  const isConnected = useStationStore((s) => s.isConnected);
  const loading = useStationStore((s) => s.loading);
  const stationName = useStationStore((s) => s.stationName);
  const disconnect = useStationStore((s) => s.disconnect);

  // Auto-navigate to the feed once the store has hydrated and a connection exists.
  // This avoids the user having to tap "View recent sightings" every time they open the app.
  useEffect(() => {
    if (!loading && isConnected) {
      router.replace('/(tabs)');
    }
  }, [loading, isConnected]);

  if (loading) {
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
            onPress={() => router.push('/connect')}
          >
            <Text className="text-base font-bold text-green-950">Connect your station</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
