import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Constants from 'expo-constants';
import { afterRun, getShareState, saveShareState, shareOnce, EMPTY_STATE, type ShareState } from '../lib/phoneShare';
import { getPhoneLocation } from '../lib/phoneLocation';
import { ago } from '../lib/baseHealth';

interface Props {
  stationId: string;
  stationName: string;
  hostUrl: string;
  apiKey: string | null;
  deviceId: string | null;
  /** Registers the station with Wildlife Network (makes its key) and returns key and device id, or null on failure. */
  register: () => Promise<{ apiKey: string; deviceId: string } | null>;
  onChange?: (s: ShareState) => void;
}

/** "Share from this phone" for a BirdNET-Go station: turn on, see what was sent, send now, stop. */
export default function PhoneShare({ stationId, stationName, hostUrl, apiKey, deviceId, register, onChange }: Props) {
  const [state, setState] = useState<ShareState>(EMPTY_STATE);
  const [busy, setBusy] = useState<'on' | 'now' | 'place' | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const update = useCallback(
    async (s: ShareState) => {
      await saveShareState(stationId, s);
      setState(s);
      onChange?.(s);
    },
    [stationId, onChange],
  );

  useEffect(() => {
    void getShareState(stationId).then((s) => {
      setState(s);
      onChange?.(s);
    });
  }, [stationId, onChange]);

  async function run(s: ShareState, key: string, dev: string) {
    const r = await shareOnce({ hostUrl, apiKey: key, deviceId: dev, stationName, appVersion: Constants.expoConfig?.version ?? '0.0.0' }, s);
    const next = afterRun(s, r);
    await update(next);
    setNote(r.ok ? (r.sent ? `Sent ${r.sent.toLocaleString()} detections.` : 'Up to date: no new detections to send.') : null);
  }

  async function turnOn() {
    setBusy('on');
    setNote(null);
    let key = apiKey, dev = deviceId;
    if (!key || !dev) {
      const reg = await register();
      if (!reg) return setBusy(null);
      key = reg.apiKey;
      dev = reg.deviceId;
    }
    await run({ ...state, on: true }, key, dev);
    setBusy(null);
  }

  async function sendNow() {
    if (!apiKey || !deviceId) return;
    setBusy('now');
    await run(state, apiKey, deviceId);
    setBusy(null);
  }

  async function takePhonePlace() {
    setBusy('place');
    const loc = await getPhoneLocation(true);
    if (loc.ok && loc.source === 'gps') {
      const next = { ...state, lat: Number(loc.lat), lon: Number(loc.lon) };
      await update(next);
      if (apiKey && deviceId) await run(next, apiKey, deviceId);
    } else {
      setNote(loc.ok ? 'Only an approximate area was found. Stand next to the station with location on, and try again.' : `${loc.error}.`);
    }
    setBusy(null);
  }

  const card = 'mb-3 rounded-2xl bg-white dark:bg-gray-900 p-4';
  const primary = 'mb-3 items-center rounded-2xl bg-green-700 py-3.5 active:opacity-75';
  const secondary = 'mb-3 items-center rounded-2xl border border-green-700 dark:border-green-400 py-3 active:opacity-75';

  if (!state.on) {
    return (
      <View className="mb-6">
        <Pressable accessibilityRole="button" className={primary} disabled={busy != null} onPress={() => void turnOn()}>
          {busy === 'on' ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-semibold text-white">Share from this phone</Text>}
        </Pressable>
        <Text className="px-1 text-xs text-gray-500 dark:text-gray-400">
          Nothing to install on the station. BirdEcho sends new detections whenever this phone is on the same Wi-Fi as
          {` ${stationName}`} and you open the app, starting with the last 7 days. Detections below 70% confidence, or
          marked wrong in BirdNET-Go, are not sent. The location is rounded to about 1 km.
        </Text>
      </View>
    );
  }

  const placeProblem = state.problem?.includes('where it is');
  return (
    <View className="mb-6">
      <View className={card}>
        <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">Sharing from this phone</Text>
        <Text className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          {state.sent > 0
            ? `${state.sent.toLocaleString()} detections sent so far${state.lastSent ? `, last ${ago(state.lastSent)}` : ''}.`
            : 'Nothing sent yet.'}
        </Text>
        <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Sends when this phone is on the same Wi-Fi as the station and you open BirdEcho, at most every 10 minutes.
        </Text>
        {state.problem ? <Text className="mt-2 text-sm text-amber-700 dark:text-amber-300">{state.problem}</Text> : null}
        {note ? <Text className="mt-2 text-sm text-green-700 dark:text-green-300">{note}</Text> : null}
      </View>
      {placeProblem ? (
        <Pressable accessibilityRole="button" className={primary} disabled={busy != null} onPress={() => void takePhonePlace()}>
          {busy === 'place' ? <ActivityIndicator color="#fff" /> : <Text className="text-sm font-semibold text-white">Use this phone’s location for the station</Text>}
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="button" className={secondary} disabled={busy != null} onPress={() => void sendNow()}>
        {busy === 'now' ? <ActivityIndicator color="#347F57" /> : <Text className="text-sm font-semibold text-green-700 dark:text-green-300">Send now</Text>}
      </Pressable>
      <Pressable accessibilityRole="button" className="items-center py-2" disabled={busy != null} onPress={() => void update({ ...state, on: false })}>
        <Text className="text-sm font-semibold text-red-600 dark:text-red-300">Stop sharing from this phone</Text>
      </Pressable>
    </View>
  );
}
