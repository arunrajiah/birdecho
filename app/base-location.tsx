import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { configureBase, getBaseInfo, type BaseInfo } from '../src/lib/base';
import { getBases, saveBase, type ManagedBase } from '../src/lib/secureStorage';
import { fetchNear } from '../src/lib/wildnetwork';
import { LOCATION_CHANGE_NOTE, buildLocationRequest, formatLocation, locationErrorMessage, pickSetupCode } from '../src/lib/baseLocation';

const input =
  'mb-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3.5 text-gray-900 dark:text-gray-50';
const label = 'mb-1 text-sm font-medium text-gray-700 dark:text-gray-300';
const hint = 'mb-4 text-xs text-gray-500 dark:text-gray-400';

/**
 * Change the location of a Base that was moved: POST /api/config with only latitude and longitude, over the
 * address the Base page reached it at (its own Wi-Fi or the home network). The Base updates wdx-agent and
 * BirdNET-Go and restarts both.
 */
export default function BaseLocationScreen() {
  const { id, url } = useLocalSearchParams<{ id: string; url: string }>();
  const [base, setBase] = useState<ManagedBase | null>(null);
  const [info, setInfo] = useState<BaseInfo | null>(null);
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [code, setCode] = useState('');
  const [askCode, setAskCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ warnings: string[]; notes: string[] } | null>(null);

  useEffect(() => {
    void getBases().then((all) => {
      const b = all.find((x) => x.deviceId === id || x.hardwareId === id) ?? null;
      setBase(b);
      // Bases set up from this phone keep their setup code; ask only when it is missing.
      if (b && !pickSetupCode(b.setupCode, '').ok) setAskCode(true);
    });
  }, [id]);

  useEffect(() => {
    if (!base || !url) return;
    void getBaseInfo(url, 5000)
      .then((i) => {
        if (i.hardwareId !== base.hardwareId) return setError('A different Base answered at this address. Go back and check again.');
        setInfo(i);
      })
      .catch((e) => setError(locationErrorMessage(e).message));
  }, [base, url]);

  async function fillFromArea() {
    setLocating(true);
    const n = await fetchNear();
    setLocating(false);
    if (!n) return setError('Could not find this phone’s area. Enter the latitude and longitude instead.');
    setError(null);
    setLat(String(n.lat));
    setLon(String(n.lon));
  }

  function save() {
    if (!base || !url) return;
    setError(null);
    const req = buildLocationRequest(lat, lon, base.setupCode, askCode ? code : '');
    if (!req.ok) return setError(req.error);
    const { latitude, longitude } = req.value.config;
    Alert.alert('Change the location?', `${base.name} moves to ${latitude}, ${longitude}. ${LOCATION_CHANGE_NOTE}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Change location',
        onPress: () =>
          void (async () => {
            setBusy(true);
            try {
              const r = await configureBase(url, req.value.code, req.value.config);
              const updated: ManagedBase = { ...base, latitude: latitude!, longitude: longitude!, setupCode: req.value.code };
              await saveBase(updated);
              setBase(updated);
              setDone({ warnings: r.warnings ?? [], notes: r.notes ?? [] });
            } catch (e) {
              const m = locationErrorMessage(e);
              if (m.askForCode) setAskCode(true);
              setError(m.message);
            } finally {
              setBusy(false);
            }
          })(),
      },
    ]);
  }

  if (!base) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950">
        <ActivityIndicator color="#347F57" />
      </View>
    );
  }

  if (done) {
    return (
      <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-950" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text className="text-[28px] font-bold text-gray-900 dark:text-gray-50">Location changed</Text>
        <Text className="mt-3 text-base text-gray-800 dark:text-gray-100">
          {base.name} now uses {formatLocation(base.latitude, base.longitude)}. It restarts its recorder, which takes about a minute.
        </Text>
        <Text className="mt-2 text-sm text-gray-600 dark:text-gray-300">{LOCATION_CHANGE_NOTE}</Text>
        {done.warnings.length + done.notes.length > 0 ? (
          <View className="mt-3 rounded-2xl bg-amber-50 dark:bg-amber-950 p-4" accessibilityRole="alert">
            <Text className="text-sm font-semibold text-amber-800 dark:text-amber-300">The Base said</Text>
            {[...done.warnings, ...done.notes].map((w) => (
              <Text key={w} className="mt-1 text-sm text-amber-800 dark:text-amber-300">{w}</Text>
            ))}
          </View>
        ) : null}
        <Pressable accessibilityRole="button" className="mt-6 items-center rounded-2xl bg-green-700 py-3.5 active:opacity-75" onPress={() => router.back()}>
          <Text className="text-base font-semibold text-white">Done</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-950" contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text className="text-[28px] font-bold text-gray-900 dark:text-gray-50">Change location</Text>
      <Text className="mt-1 mb-5 text-sm text-gray-600 dark:text-gray-300">For {base.name} after it was moved.</Text>

      <View className="mb-5 rounded-2xl bg-white dark:bg-gray-900 px-4 py-3">
        <Text className="text-sm text-gray-600 dark:text-gray-300">Location on the Base now</Text>
        {info ? (
          <Text className="mt-1 text-base font-medium text-gray-900 dark:text-gray-50">{formatLocation(info.latitude, info.longitude)}</Text>
        ) : error ? null : (
          <ActivityIndicator className="mt-1 self-start" color="#347F57" />
        )}
      </View>

      <Text className={label}>New location</Text>
      <Pressable accessibilityRole="button" className="mb-3 items-center rounded-2xl border border-green-700 dark:border-green-400 py-3 active:opacity-75" disabled={locating} onPress={() => void fillFromArea()}>
        {locating ? <ActivityIndicator color="#347F57" /> : <Text className="text-sm font-semibold text-green-700 dark:text-green-300">Start from this phone&apos;s area</Text>}
      </Pressable>
      <View className="flex-row gap-3">
        <TextInput className={`flex-1 ${input}`} value={lat} onChangeText={setLat} placeholder="Latitude, e.g. 13.08" keyboardType="numbers-and-punctuation" accessibilityLabel="Latitude" />
        <TextInput className={`flex-1 ${input}`} value={lon} onChangeText={setLon} placeholder="Longitude, e.g. 80.27" keyboardType="numbers-and-punctuation" accessibilityLabel="Longitude" />
      </View>
      <Text className={hint}>
        The phone&apos;s area is approximate (whole degrees); adjust it to where the Base stands now. Only a position rounded to about 1 km is ever shared.
      </Text>

      {askCode ? (
        <>
          <Text className={label}>Setup code</Text>
          <TextInput className={input} value={code} onChangeText={setCode} placeholder="ABCD EFGH" autoCapitalize="characters" autoCorrect={false} maxLength={11} />
          <Text className={hint}>On the label on the Base, and in wildnetwork-setup.txt on its SD card. It stays on this phone and is only sent to the Base.</Text>
        </>
      ) : null}

      {error ? <Text className="mb-3 text-sm text-red-600">{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        className={`mt-2 items-center rounded-2xl py-3.5 active:opacity-75 ${busy || !info ? 'bg-gray-300 dark:bg-gray-700' : 'bg-green-700'}`}
        disabled={busy || !info}
        onPress={save}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-semibold text-white">Save</Text>}
      </Pressable>
    </ScrollView>
  );
}
