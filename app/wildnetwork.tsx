import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Share, Linking, ActivityIndicator, TextInput } from 'react-native';
import { useStationStore } from '../src/stores/stationStore';
import { getWildNetworkKey, setWildNetworkKey } from '../src/lib/secureStorage';
import {
  WILDNETWORK_BASE,
  WILDNETWORK_CONTRIBUTE_URL,
  installCommand,
  registerWithWildNetwork,
  wildNetworkSource,
} from '../src/lib/wildnetwork';

type BirdWeatherAnswer = 'unknown' | 'yes' | 'no';

/** Approximate station location, used for WildNetwork's "near you" lists (5 degree squares). */
function AreaSection() {
  const station = useStationStore((s) => s.stations.find((st) => st.id === s.activeStationId) ?? null);
  const setStationLocation = useStationStore((s) => s.setStationLocation);
  const [lat, setLat] = useState(station?.latitude?.toString() ?? '');
  const [lon, setLon] = useState(station?.longitude?.toString() ?? '');
  const [saved, setSaved] = useState(false);
  if (!station || station.connectionType === 'birdweather' || station.connectionType === 'demo') return null;

  const latN = Number(lat), lonN = Number(lon);
  const valid = lat.trim() !== '' && lon.trim() !== '' && Math.abs(latN) <= 90 && Math.abs(lonN) <= 180;
  const input = 'flex-1 rounded-xl border border-gray-200 bg-gray-50 dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white';

  return (
    <View className="mb-8">
      <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">Station area</Text>
      <Text className="mb-3 text-sm text-gray-600 dark:text-gray-300">
        Used for the Near you list on the Stats tab. One decimal place is plenty: WildNetwork works
        in 5 degree squares. It stays on this phone.
      </Text>
      <View className="mb-3 flex-row gap-3">
        <TextInput className={input} placeholder="Latitude, e.g. 51.5" keyboardType="numbers-and-punctuation"
          value={lat} onChangeText={(t) => { setLat(t); setSaved(false); }} />
        <TextInput className={input} placeholder="Longitude, e.g. -0.1" keyboardType="numbers-and-punctuation"
          value={lon} onChangeText={(t) => { setLon(t); setSaved(false); }} />
      </View>
      <Pressable
        className={`items-center rounded-xl py-3 active:opacity-75 ${valid ? 'bg-green-700' : 'bg-gray-300'}`}
        disabled={!valid}
        onPress={() => void setStationLocation(station.id, latN, lonN).then(() => setSaved(true))}
      >
        <Text className="text-sm font-semibold text-white">{saved ? 'Saved' : 'Save area'}</Text>
      </Pressable>
    </View>
  );
}

export default function WildNetworkScreen() {
  const station = useStationStore((s) => s.stations.find((st) => st.id === s.activeStationId) ?? null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [uploadsToBirdWeather, setUploadsToBirdWeather] = useState<BirdWeatherAnswer>('unknown');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reuse a key issued earlier for this station so revisiting does not register again.
  const stationId = station?.id;
  useEffect(() => {
    if (!stationId) return;
    void getWildNetworkKey(stationId).then((k) => {
      setApiKey(k);
      setChecked(true);
    });
  }, [stationId]);

  if (!station || !wildNetworkSource(station.connectionType)) {
    return (
      <ScrollView className="flex-1 bg-white dark:bg-gray-950">
        <View className="px-5 pt-6 pb-10">
          <AreaSection />
          <Text className="text-sm text-gray-500">
            Sharing with WildNetwork works for BirdNET-Pi and BirdNET-Go stations. Stations on
            BirdWeather are already included on the WildNetwork map.
          </Text>
        </View>
      </ScrollView>
    );
  }

  async function handleRegister() {
    if (!station) return;
    setBusy(true);
    setError(null);
    try {
      const key = await registerWithWildNetwork(station.stationName, station.connectionType);
      await setWildNetworkKey(station.id, key);
      setApiKey(key);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed.');
    } finally {
      setBusy(false);
    }
  }

  const command = apiKey ? installCommand(apiKey) : null;

  return (
    <ScrollView className="flex-1 bg-white dark:bg-gray-950">
      <View className="px-5 pt-6 pb-10">
        <Text className="mb-2 text-xl font-bold text-gray-900 dark:text-white">
          Share with WildNetwork
        </Text>
        <Text className="mb-6 text-sm text-gray-600 dark:text-gray-300">
          WildNetwork is a free, open map of where birds and animals are and where they are
          going. Your station can add its detections. A small agent on your Pi sends them; your
          location is rounded to about 1 km before anything leaves the Pi.
        </Text>

        <AreaSection />

        {!checked ? (
          <ActivityIndicator />
        ) : command ? (
          <>
            <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              Run this on your Pi
            </Text>
            <Text className="mb-3 text-sm text-gray-600 dark:text-gray-300">
              Open a terminal on the Pi running {station.stationName} (for example over SSH) and
              paste this command. It installs the agent and starts sending.
            </Text>
            <View className="mb-3 rounded-xl border border-gray-200 bg-gray-50 dark:bg-gray-900 p-4">
              <Text selectable className="font-mono text-xs text-gray-800 dark:text-gray-200">
                {command}
              </Text>
            </View>
            <Pressable
              className="mb-3 items-center rounded-xl bg-green-700 py-3 active:opacity-75"
              onPress={() => void Share.share({ message: command })}
            >
              <Text className="text-sm font-semibold text-white">Share or copy command</Text>
            </Pressable>
            <Text className="mb-6 px-1 text-xs text-gray-400">
              The command contains this station&apos;s device key. Keep it to yourself and run it on
              one Pi only.
            </Text>
          </>
        ) : (
          <>
            <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
              Does this station upload to BirdWeather?
            </Text>
            <View className="mb-4 flex-row rounded-xl border border-gray-200 overflow-hidden">
              {(['yes', 'no'] as const).map((a) => (
                <Pressable
                  key={a}
                  className={`flex-1 items-center py-2.5 active:opacity-75 ${
                    uploadsToBirdWeather === a ? 'bg-green-700' : 'bg-white dark:bg-gray-900'
                  }`}
                  onPress={() => setUploadsToBirdWeather(a)}
                >
                  <Text
                    className={`text-sm font-medium capitalize ${
                      uploadsToBirdWeather === a ? 'text-white' : 'text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {a}
                  </Text>
                </Pressable>
              ))}
            </View>

            {uploadsToBirdWeather === 'yes' && (
              <Text className="mb-6 text-sm text-gray-600 dark:text-gray-300">
                You are already on the map. WildNetwork includes BirdWeather stations
                automatically, so installing the agent as well would count your detections twice.
              </Text>
            )}

            {uploadsToBirdWeather === 'no' && (
              <>
                <Pressable
                  className="mb-3 items-center rounded-xl bg-green-700 py-3 active:opacity-75"
                  disabled={busy}
                  onPress={() => void handleRegister()}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-sm font-semibold text-white">Get install command</Text>
                  )}
                </Pressable>
                <Text className="mb-6 px-1 text-xs text-gray-400">
                  This registers {station.stationName} with WildNetwork and creates a device key
                  for it. Nothing else is sent from your phone.
                </Text>
              </>
            )}

            {error && <Text className="mb-6 text-sm text-red-600">{error}</Text>}
          </>
        )}

        <Pressable onPress={() => void Linking.openURL(WILDNETWORK_CONTRIBUTE_URL)}>
          <Text className="text-sm font-medium text-green-700">Full setup guide</Text>
        </Pressable>
        <Pressable className="mt-3" onPress={() => void Linking.openURL(WILDNETWORK_BASE)}>
          <Text className="text-sm font-medium text-green-700">Open the WildNetwork map</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
