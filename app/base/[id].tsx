import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { getBases, removeBase, type ManagedBase } from '../../src/lib/secureStorage';
import { BASE_HOTSPOT_URL, getBaseInfo, getBaseStatus, joinHotspot, leaveHotspot, routeToBase } from '../../src/lib/base';
import { WILDNETWORK_BASE } from '../../src/lib/wildnetwork';
import { useStationStore } from '../../src/stores/stationStore';
import CollectDetections from '../../src/components/CollectDetections';
import { baseApiUrlFor } from '../../src/lib/baseStation';
import {
  ago,
  fetchDeviceHealth,
  formatSignal,
  formatUptime,
  healthFromLocal,
  healthFromReport,
  isTestBase,
  micWarning,
  type BaseHealth,
} from '../../src/lib/baseHealth';

interface CloudDevice {
  id: string;
  lastReport: string | null;
  battery: { percent?: number; charging?: boolean } | null;
  storage: { freeMb?: number; totalMb?: number } | null;
  temperatureC: number | null;
  queue: { pending?: number } | null;
}

function Line({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <View className="flex-row justify-between py-2 border-b border-gray-100 dark:border-gray-800">
      <Text className="text-sm text-gray-600 dark:text-gray-300">{k}</Text>
      <Text className={`ml-3 flex-shrink text-right text-sm font-medium ${warn ? 'text-red-600 dark:text-red-300' : 'text-gray-900 dark:text-gray-50'}`}>{v}</Text>
    </View>
  );
}

function Health({ h }: { h: BaseHealth }) {
  const st = h.storage;
  const warning = micWarning(h);
  return (
    <>
      {warning ? (
        <View className="mb-2 rounded-2xl bg-red-50 dark:bg-red-950 p-4" accessibilityRole="alert">
          <Text className="text-sm font-semibold text-red-700 dark:text-red-300">Microphone not active</Text>
          <Text className="mt-1 text-sm text-red-700 dark:text-red-300">{warning}</Text>
        </View>
      ) : null}
      <View className="rounded-2xl bg-white dark:bg-gray-900 px-4 py-2">
        <Line k="Microphone" v={h.micActive == null ? 'not reported' : h.micActive ? 'active' : 'not active'} warn={h.micActive === false} />
        <Line k="Last detection" v={h.lastDetectionAt ? ago(h.lastDetectionAt) : 'not reported'} />
        <Line k="Temperature" v={h.temperatureC != null ? `${h.temperatureC} °C` : 'not reported'} />
        <Line k="Running for" v={formatUptime(h.uptimeSeconds)} />
        <Line k="Network" v={formatSignal(h.networkType, h.signal)} />
        <Line k="Waiting to upload" v={h.queuePending != null ? `${h.queuePending} detections` : 'not reported'} />
        <Line k="Free storage" v={st?.freeMb != null ? `${(st.freeMb / 1000).toFixed(1)} of ${((st.totalMb ?? 0) / 1000).toFixed(1)} GB` : 'not reported'} />
        {h.battery?.percent != null ? <Line k="Battery" v={`${h.battery.percent}%${h.battery.charging ? ', charging' : ''}`} /> : null}
      </View>
    </>
  );
}

function fromCloudDevice(d: CloudDevice): BaseHealth {
  return {
    ...healthFromLocal({}),
    at: d.lastReport,
    temperatureC: d.temperatureC,
    queuePending: d.queue?.pending ?? null,
    storage: d.storage,
    battery: d.battery,
  };
}

const heading = 'mt-6 mb-2 ml-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400';

/**
 * Base health (BASE-FIELD-APP.md flow 2). From the Base itself when the phone can reach it (its home network
 * address, or its hotspot on request), and from Wildlife Network: the device's own health reports when this
 * phone holds the Base's device key, else the public device list.
 */
export default function BaseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [base, setBase] = useState<ManagedBase | null>(null);
  const [cloud, setCloud] = useState<{ health: BaseHealth | null; history: number; full: boolean } | undefined>(undefined);
  const [local, setLocal] = useState<{ health: BaseHealth; test: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The Base's own BirdNET-Go station gives its home network address when none was saved at setup.
  const stationHost = useStationStore((s) => s.stations.find((st) => base && st.baseId === base.hardwareId)?.hostUrl);

  useEffect(() => () => leaveHotspot(), []);
  useEffect(() => {
    void getBases().then((all) => setBase(all.find((b) => b.deviceId === id || b.hardwareId === id) ?? null));
  }, [id]);

  // Wildlife Network: the detailed health endpoint needs this Base's device key, which the phone only holds when
  // it registered the Base itself. Otherwise the public list, which has the last report time and a few fields.
  useEffect(() => {
    if (!base) return;
    let live = true;
    void (async () => {
      const full = base.deviceId && base.apiKey ? await fetchDeviceHealth(base.deviceId, base.apiKey) : null;
      if (full) {
        if (live) setCloud({ health: healthFromReport(full.latest), history: full.history.length, full: true });
        return;
      }
      const dev = await fetch(`${WILDNETWORK_BASE}/api/v1/devices`)
        .then((r) => r.json() as Promise<{ devices?: CloudDevice[] }>)
        .then((j) => j.devices?.find((d) => d.id === (base.deviceId || id)) ?? null)
        .catch(() => null);
      if (live) setCloud({ health: dev ? fromCloudDevice(dev) : null, history: 0, full: false });
    })();
    return () => {
      live = false;
    };
  }, [base, id]);

  // Straight from the Base when it is on the same network as the phone.
  const lanUrl = base?.address ?? (stationHost ? baseApiUrlFor(stationHost) : null);
  useEffect(() => {
    if (!base || !lanUrl) return;
    let live = true;
    void getBaseInfo(lanUrl, 3000)
      .then((info) => {
        if (live && info.hardwareId === base.hardwareId) setLocal({ health: healthFromLocal(info), test: isTestBase(info) });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [base, lanUrl]);

  const checkLocally = useCallback(async () => {
    if (!base) return;
    setBusy(true);
    setError(null);
    try {
      const r = base.ssid ? await joinHotspot(base.ssid, base.setupCode) : 'unsupported';
      if (r === 'connected') routeToBase(true);
      const [info, status] = await Promise.all([getBaseInfo(BASE_HOTSPOT_URL).catch(() => null), getBaseStatus(BASE_HOTSPOT_URL)]);
      setLocal({ health: healthFromLocal(info, status), test: isTestBase(info) });
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
      <Text className="mb-2 text-xs text-gray-500 dark:text-gray-400">{base.ssid || base.hardwareId}</Text>
      {local?.test ? (
        <View className="mb-2 self-start rounded-full bg-amber-100 dark:bg-amber-900 px-3 py-1">
          <Text className="text-xs font-semibold text-amber-800 dark:text-amber-200">Test station, not on the public map</Text>
        </View>
      ) : null}

      <Text className={heading}>Last report to Wildlife Network</Text>
      {cloud === undefined ? (
        <ActivityIndicator className="my-4" color="#347F57" />
      ) : cloud.health ? (
        <>
          <Text className="mb-2 ml-1 text-sm text-gray-700 dark:text-gray-200">
            {ago(cloud.health.at)}
            {cloud.full && cloud.history > 1 ? ` · ${cloud.history} reports kept` : ''}
          </Text>
          <Health h={cloud.health} />
          {!cloud.full ? (
            <Text className="mt-2 ml-1 text-xs text-gray-500 dark:text-gray-400">
              The full health report needs the Base&apos;s device key, which this phone only has when it registered the Base.
            </Text>
          ) : null}
        </>
      ) : (
        <Text className="mb-2 ml-1 text-sm text-gray-600 dark:text-gray-300">
          No report yet. The Base reports once it has internet, through home Wi-Fi or a SIM.
        </Text>
      )}

      <Text className={heading}>Straight from the Base</Text>
      {local ? <Health h={local.health} /> : null}
      {error ? <Text className="my-2 text-sm text-red-600">{error}</Text> : null}
      <Pressable accessibilityRole="button" className="mt-2 items-center rounded-2xl bg-green-700 py-3.5 active:opacity-75" disabled={busy} onPress={() => void checkLocally()}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-base font-semibold text-white">Check over the Base&apos;s Wi-Fi</Text>}
      </Pressable>
      <Text className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {lanUrl
          ? 'On the same Wi-Fi as the Base this fills in by itself. Away from it, stand near the Base: the phone joins its Wi-Fi only for this check.'
          : 'Stand near the Base. The phone joins its Wi-Fi only for this check.'}
      </Text>

      <CollectDetections base={base} onBaseChange={setBase} />

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
