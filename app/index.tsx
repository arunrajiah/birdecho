import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useStationStore } from '../src/stores/stationStore';

export default function HomeScreen() {
  const stationId = useStationStore((s) => s.stationId);
  const stationName = useStationStore((s) => s.stationName);
  const disconnect = useStationStore((s) => s.disconnect);

  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-4xl font-bold text-gray-900">Perch</Text>
      <Text className="mt-2 text-base text-gray-500 text-center">
        A companion for your backyard bird station.
      </Text>

      {stationId ? (
        <>
          <Text className="mt-6 text-lg font-semibold text-green-700">
            {stationName ?? stationId}
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
