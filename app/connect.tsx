import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useStationStore } from '../src/stores/stationStore';
import { fetchStation } from '../src/api/station';
import { pingBirdNetGo } from '../src/api/adapters/birdnetgo';

type Mode = 'birdweather' | 'birdnetgo';

export default function ConnectScreen() {
  const [mode, setMode] = useState<Mode>('birdweather');

  // BirdWeather fields
  const [token, setTokenValue] = useState('');
  const [stationId, setStationId] = useState('');

  // BirdNET-Go direct fields
  const [hostUrl, setHostUrl] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectBirdWeather = useStationStore((s) => s.connectBirdWeather);
  const connectBirdNetGo = useStationStore((s) => s.connectBirdNetGo);

  function validateBirdWeather(): string | null {
    if (!token.trim()) return 'Token is required.';
    if (!stationId.trim()) return 'Station ID is required.';
    if (!/^\d+$/.test(stationId.trim())) return 'Station ID must be a number (e.g. 12345).';
    return null;
  }

  function validateBirdNetGo(): string | null {
    const url = hostUrl.trim();
    if (!url) return 'Host URL is required.';
    if (!/^https?:\/\/.+/.test(url)) return 'Host URL must start with http:// or https://';
    return null;
  }

  async function handleConnectBirdWeather() {
    const validationError = validateBirdWeather();
    if (validationError) { setError(validationError); return; }
    setLoading(true);
    setError(null);
    try {
      const station = await fetchStation(stationId.trim(), token.trim());
      await connectBirdWeather(token.trim(), stationId.trim(), station.name, station.timezone);
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

  async function handleConnectBirdNetGo() {
    const validationError = validateBirdNetGo();
    if (validationError) { setError(validationError); return; }
    setLoading(true);
    setError(null);
    try {
      const stationName = await pingBirdNetGo(hostUrl.trim());
      await connectBirdNetGo(hostUrl.trim(), stationName);
      router.replace('/');
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('Could not reach BirdNET-Go station. Check the URL and your network.');
      }
    } finally {
      setLoading(false);
    }
  }

  const handleConnect = mode === 'birdweather' ? handleConnectBirdWeather : handleConnectBirdNetGo;
  const canSubmit = mode === 'birdweather'
    ? !!(token.trim() && stationId.trim())
    : !!hostUrl.trim();

  return (
    <ScrollView className="flex-1 bg-white" contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 40, paddingBottom: 32 }}>
      <Text className="mb-6 text-2xl font-bold text-gray-900">Connect your station</Text>

      {/* Mode toggle */}
      <View className="mb-8 flex-row rounded-xl border border-gray-200 overflow-hidden">
        <Pressable
          className={`flex-1 py-2.5 items-center ${mode === 'birdweather' ? 'bg-green-700' : 'bg-white'}`}
          onPress={() => { setMode('birdweather'); setError(null); }}
        >
          <Text className={`text-sm font-semibold ${mode === 'birdweather' ? 'text-white' : 'text-gray-600'}`}>
            BirdWeather
          </Text>
        </Pressable>
        <Pressable
          className={`flex-1 py-2.5 items-center ${mode === 'birdnetgo' ? 'bg-green-700' : 'bg-white'}`}
          onPress={() => { setMode('birdnetgo'); setError(null); }}
        >
          <Text className={`text-sm font-semibold ${mode === 'birdnetgo' ? 'text-white' : 'text-gray-600'}`}>
            BirdNET-Go direct
          </Text>
        </Pressable>
      </View>

      {mode === 'birdweather' ? (
        <>
          <Text className="mb-1 text-sm font-medium text-gray-700">Station token</Text>
          <TextInput
            className="mb-4 rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900"
            value={token}
            onChangeText={setTokenValue}
            placeholder="Your BirdWeather API token"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />

          <Text className="mb-1 text-sm font-medium text-gray-700">Station ID</Text>
          <TextInput
            className="mb-2 rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900"
            value={stationId}
            onChangeText={setStationId}
            placeholder="e.g. 12345"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numeric"
          />
          <Text className="mb-6 text-xs text-gray-400">
            Find your token and station ID at app.birdweather.com → Account settings
          </Text>
        </>
      ) : (
        <>
          <Text className="mb-1 text-sm font-medium text-gray-700">BirdNET-Go host URL</Text>
          <TextInput
            className="mb-2 rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-gray-900"
            value={hostUrl}
            onChangeText={setHostUrl}
            placeholder="http://192.168.1.100:8080"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text className="mb-6 text-xs text-gray-400">
            Enter the local URL of your BirdNET-Go instance. No token required — read-only API access is public by default.
          </Text>
        </>
      )}

      {error ? (
        <Text className="mb-4 text-sm text-red-600">{error}</Text>
      ) : null}

      <Pressable
        className="items-center rounded-xl bg-green-700 py-3 active:opacity-75 disabled:opacity-50"
        onPress={handleConnect}
        disabled={loading || !canSubmit}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-base font-semibold text-white">Connect</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
