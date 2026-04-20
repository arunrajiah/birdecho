import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useStationStore } from '../src/stores/stationStore';
import { fetchStation } from '../src/api/station';
import { setToken } from '../src/lib/secureStorage';

export default function ConnectScreen() {
  const [token, setTokenValue] = useState('');
  const [stationId, setStationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connect = useStationStore((s) => s.connect);

  async function handleConnect() {
    if (!token.trim() || !stationId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await setToken(token.trim());
      const station = await fetchStation(stationId.trim());
      await connect(token.trim(), stationId.trim(), station.name);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect. Check your token and station ID.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-white px-6 pt-16">
      <Text className="mb-8 text-2xl font-bold text-gray-900">Connect your station</Text>

      <Text className="mb-1 text-sm font-medium text-gray-700">Station token</Text>
      <TextInput
        className="mb-4 rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900"
        value={token}
        onChangeText={setTokenValue}
        placeholder="Enter your BirdWeather token"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />

      <Text className="mb-1 text-sm font-medium text-gray-700">Station ID</Text>
      <TextInput
        className="mb-6 rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900"
        value={stationId}
        onChangeText={setStationId}
        placeholder="e.g. 12345"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numeric"
      />

      {error ? (
        <Text className="mb-4 text-sm text-red-600">{error}</Text>
      ) : null}

      <Pressable
        className="items-center rounded-xl bg-green-700 py-3 active:opacity-75 disabled:opacity-50"
        onPress={handleConnect}
        disabled={loading || !token.trim() || !stationId.trim()}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-base font-semibold text-white">Connect</Text>
        )}
      </Pressable>
    </View>
  );
}
