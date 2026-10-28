import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getBases, removeBase, type ManagedBase } from '../../src/lib/secureStorage';
import { BASE_HOTSPOT_URL, getBaseStatus, joinHotspot, leaveHotspot, routeToBase, type BaseStatus } from '../../src/lib/base';
import { WILDNETWORK_BASE } from '../../src/lib/wildnetwork';

interface CloudDevice {
  id: string;
  lastReport: string | null;
  battery: { percent?: number; charging?: boolean } | null;
  storage: { freeMb?: number; totalMb?: number } | null;
  temperatureC: number | null;
  queue: { pending?: number } | null;
}

function ago(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 2) return 'just now';
  if (m < 120) return `${m} minutes ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} hours ago` : `${Math.round(h / 24)} days ago`;
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <View className="flex-row justify-between py-2 border-b border-gray-100 dark:border-gray-800">
      <Text className="text-sm text-gray-600 dark:text-gray-300">{k}</Text>
      <Text className="text-sm font-medium text-gray-900 dark:text-gray-50">{v}</Text>
    </View>
  );
}

function Health({ s }: { s: Partial<CloudDevice & BaseStatus> }) {
  const st = s.storage;
  return (
    <View className="rounded-2xl bg-white dark:bg-gray-900 px-4 py-2">
      <Line k="Battery" v={s.battery?.percent != null ? `${s.battery.percent}%${s.battery.charging ? ', charging' : ''}` : 'not reported'} />
      <Line k="Free storage" v={st?.freeMb != null ? `${(st.freeMb / 1000).toFixed(1)} of ${((st.totalMb ?? 0) / 1000).toFixed(1)} GB` : 'not reported'} />
      <Line k="Temperature" v={s.temperatureC != null ? `${s.temperatureC} °C` : 'not reported'} />
      <Line k="Waiting to upload" v={s.queue?.pending != null ? `${s.queue.pending} detections` : 'not reported'} />
    </View>
  );
}

/** Base health (BASE-FIELD-APP.md flow 2): Wildlife Network's latest report, or /api/status on the Base's Wi-Fi. */
export default function BaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [base, setBase] = useState<ManagedBase | null>(null);
  const [cloud, setCloud] = useState<CloudDevice | null | undefined>(undefined);
  const [local, setLocal] = useState<BaseStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => leaveHotspot(), []);
  useEffect(() => {
    void getBases().then((all) => setBase(all.find((b) => b.deviceId === id || b.hardwareId === id) ?? null));
    fetch(`${WILDNETWORK_BASE}/api/v1/devices`)
      .then((r) => r.json())
      .then((j: { devices?: CloudDevice[] }) => setCloud(j.devices?.find((d) => d.id === id) ?? null))
      .catch(() => setCloud(null));
  }, [id]);

  const checkLocally = useCallback(async () => {
    if (!base) return;
    setBusy(true);
    setError(null);
    try {
      const r = base.ssid ? await joinHotspot(base.ssid, base.setupCode) : 'unsupported';
      if (r === 'connected') routeToBase(true);
      setLocal(await getBaseStatus(BASE_HOTSPOT_URL));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the Base.');
    } finally {
      leaveHotspot();
      setBusy(false);
    }
  }, [base]);

  if (!base) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950">
        <ActivityIndicator color="#347F57" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-950" contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text className="text-[28px] font-bold text-gray-900 dark:text-gray-50">{base.name}</Text>
      <Text className="mb-4 text-xs text-gray-500 dark:text-gray-400">{base.ssid || base.hardwareId}</Text>

      <Text className="mb-2 ml-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        Last report to Wildlife Network
      </Text>
      {cloud === undefined ? (
        <ActivityIndicator className="my-4" color="#347F57" />
      ) : cloud ? (
        <>
          <Text className="mb-2 ml-1 text-sm text-gray-700 dark:text-gray-200">{ago(cloud.lastReport)}</Text>
          <Health s={cloud} />
        </>
      ) : (
        <Text className="mb-2 ml-1 text-sm text-gray-600 dark:text-gray-300">
          No report yet. The Base reports once it has internet, through home Wi-Fi or a SIM.
        </Text>
      )}

      <Text className="mt-6 mb-2 ml-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        Straight from the Base
      </Text>
      {local ? <Health s={local} /> : null}
      {error ? <Text className="my-2 text-sm text-red-600">{error}</Text> : null}
      <Pressable accessibilityRole="button" className="mt-2 items-center rounded-2xl bg-green-700 py-3.5 active:opacity-75" disabled={busy} onPress={() => void checkLocally()}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-semibold text-white">Check over the Base&apos;s Wi-Fi</Text>}
      </Pressable>
      <Text className="mt-2 text-xs text-gray-500 dark:text-gray-400">Stand near the Base. The phone joins its Wi-Fi only for this check.</Text>

      <Pressable
        accessibilityRole="button"
        className="mt-8 items-center rounded-2xl bg-white dark:bg-gray-900 py-3.5 active:opacity-75"
        onPress={() =>
          Alert.alert('Forget this Base?', 'It keeps working. This phone forgets its setup code and key.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Forget', style: 'destructive', onPress: () => void removeBase(base.hardwareId).then(() => router.back()) },
          ])
        }
      >
        <Text className="text-sm font-semibold text-red-600 dark:text-red-300">Forget this Base</Text>
      </Pressable>
    </ScrollView>
  );
}
