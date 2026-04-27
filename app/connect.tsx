import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useStationStore } from '../src/stores/stationStore';
import { fetchStation } from '../src/api/station';

export default function ConnectScreen() {
  const [token, setTokenValue] = useState('');
  const [stationId, setStationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connect = useStationStore((s) => s.connect);

  function validate(): string | null {
    if (!token.trim()) return 'Token is required.';
    if (!stationId.trim()) return 'Station ID is required.';
    if (!/^\d+$/.test(stationId.trim())) return 'Station ID must be a number (e.g. 12345).';
    return null;
  }

  async function handleConnect() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const station = await fetchStation(stationId.trim(), token.trim());
      await connect(token.trim(), stationId.trim(), station.name, station.timezone);
      router.replace('/');
    } catch (e) {
      if (e instanceof Error) {
        if (/API error 40[13]/.test(e.message)) {
          setError('Invalid token — check your BirdWeather API token and try again.');
        } else if (/API error 404/.test(e.message)) {
          setError('Station not found — check your station ID and try again.');
        } else if (e.message.startsWith('API error')) {
          setError('The station returned an error. Please try again later.');
        } else {
          setError('Network error — check your internet connection and try again.');
        }
      } else {
        setError('Could not connect. Check your token and station ID.');
      }
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
