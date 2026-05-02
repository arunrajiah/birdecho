import { useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
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
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#15803d" />
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-4xl font-bold text-gray-900">BirdEcho</Text>
      <Text className="mt-2 text-base text-gray-500 text-center">
        A companion for your backyard bird station.
      </Text>

      {isConnected ? (
        <>
          <Text className="mt-6 text-lg font-semibold text-green-700">
            {stationName ?? '—'}
          </Text>
          <Pressable
            className="mt-4 rounded-xl bg-green-700 px-6 py-3 active:opacity-75"
            onPress={() => router.replace('/(tabs)')}
          >
            <Text className="text-base font-semibold text-white">View recent sightings</Text>
          </Pressable>
          <Pressable
            className="mt-3 px-4 py-2 active:opacity-75"
            onPress={() => disconnect()}
          >
            <Text className="text-sm text-gray-400">Disconnect</Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          className="mt-8 rounded-xl bg-green-700 px-6 py-3 active:opacity-75"
          onPress={() => router.push('/connect')}
        >
          <Text className="text-base font-semibold text-white">Connect your station</Text>
        </Pressable>
      )}
    </View>
  );
}
