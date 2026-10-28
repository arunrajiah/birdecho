import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Linking, Share } from 'react-native';
import { router } from 'expo-router';
import { registerDevice, type RegisteredDevice } from '../src/lib/wildnetwork';

const KINDS = ['Sound', 'Camera', 'Other'] as const;
const WDX_URL = 'https://github.com/arunrajiah/wildlife-detection-exchange';
const AGENT_URL = 'https://github.com/arunrajiah/wdx-agent#any-detections-table-csv';

const input =
  'mb-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3.5 text-gray-900 dark:text-gray-50';
const label = 'mb-1 text-sm font-medium text-gray-700 dark:text-gray-300';

function Row({ title, value }: { title: string; value: string }) {
  return (
    <View className="mb-3">
      <Text className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{title}</Text>
      <Text selectable className="mt-1 font-mono text-sm text-gray-900 dark:text-gray-50">{value}</Text>
    </View>
  );
}

/** "My own (DIY) device": register it and hand over the key, once (wildnetwork/docs/BASE-FIELD-APP.md). */
export default function AddDiyScreen() {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<(typeof KINDS)[number]>('Sound');
  const [software, setSoftware] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<RegisteredDevice | null>(null);

  async function register() {
    if (name.trim().length < 3) return setError('Give the device a name of at least 3 characters.');
    setBusy(true);
    setError(null);
    try {
      const sw = software.trim() ? `, ${software.trim()}` : '';
      setDevice(await registerDevice({ name: `${name.trim()} (${kind.toLowerCase()}${sw})`.slice(0, 80), model: 'diy', source: 'other' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed.');
    } finally {
      setBusy(false);
    }
  }

  const details = device
    ? `Wildlife Network device ${device.deviceId}\nKey: ${device.apiKey}\nSend WDX events to: ${device.eventsEndpoint}\nHeader: Authorization: Bearer <key>`
    : '';

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-950" contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text className="text-[28px] font-bold text-gray-900 dark:text-gray-50">My own device</Text>
      {!device ? (
        <>
          <Text className="mt-1 mb-5 text-sm text-gray-600 dark:text-gray-300">
            Register your device to get a key. It then sends its detections to Wildlife Network itself, or through wdx-agent.
          </Text>
          <Text className={label}>Name</Text>
          <TextInput className={input} value={name} onChangeText={setName} placeholder="e.g. Pond camera" maxLength={50} />
          <Text className={label}>What it records</Text>
          <View className="mb-3 flex-row rounded-2xl bg-gray-200 dark:bg-gray-800 p-1">
            {KINDS.map((k) => (
              <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: kind === k }} className={`flex-1 items-center rounded-xl py-2.5 ${kind === k ? 'bg-white dark:bg-gray-600' : ''}`} onPress={() => setKind(k)}>
                <Text className={`text-sm font-medium ${kind === k ? 'text-gray-900 dark:text-gray-50' : 'text-gray-600 dark:text-gray-300'}`}>{k}</Text>
              </Pressable>
            ))}
          </View>
          <Text className={label}>Software that identifies species (optional)</Text>
          <TextInput className={input} value={software} onChangeText={setSoftware} placeholder="e.g. BirdNET, MegaDetector, my own model" maxLength={40} />
          {error ? <Text className="mb-3 text-sm text-red-600">{error}</Text> : null}
          <Pressable accessibilityRole="button" className="mt-2 items-center rounded-2xl bg-green-700 py-3.5 active:opacity-75" disabled={busy} onPress={() => void register()}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-semibold text-white">Register device</Text>}
          </Pressable>
        </>
      ) : (
        <>
          <Text className="mt-1 mb-4 text-sm text-gray-600 dark:text-gray-300">
            Registered. Copy the key now: it is shown only once and cannot be recovered.
          </Text>
          <View className="mb-3 rounded-2xl bg-white dark:bg-gray-900 p-4">
            <Row title="Device id" value={device.deviceId} />
            <Row title="Key" value={device.apiKey} />
            <Row title="Send WDX events to" value={device.eventsEndpoint} />
          </View>
          <Pressable accessibilityRole="button" className="items-center rounded-2xl bg-green-700 py-3.5 active:opacity-75" onPress={() => void Share.share({ message: details })}>
            <Text className="text-base font-semibold text-white">Copy or share these details</Text>
          </Pressable>
          <Text className="mt-5 mb-2 text-sm text-gray-700 dark:text-gray-200">
            Send each detection as a WDX event with the header Authorization: Bearer followed by the key. Or let wdx-agent read a CSV or NDJSON file your device writes.
          </Text>
          <Pressable accessibilityRole="link" className="mb-2" onPress={() => void Linking.openURL(WDX_URL)}>
            <Text className="text-sm font-semibold text-green-700 dark:text-green-300">The WDX event format</Text>
          </Pressable>
          <Pressable accessibilityRole="link" className="mb-4" onPress={() => void Linking.openURL(AGENT_URL)}>
            <Text className="text-sm font-semibold text-green-700 dark:text-green-300">wdx-agent: CSV and NDJSON inputs</Text>
          </Pressable>
          <Pressable accessibilityRole="button" className="items-center rounded-2xl border border-green-700 dark:border-green-400 py-3.5 active:opacity-75" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
            <Text className="text-base font-semibold text-green-700 dark:text-green-300">Done</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}
