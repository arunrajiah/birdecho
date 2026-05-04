import { useState } from 'react';
import { View, Text, Pressable, Switch, Alert } from 'react-native';
import { router } from 'expo-router';
import { useStationStore } from '../../src/stores/stationStore';
import { useThemeStore } from '../../src/stores/themeStore';
import { requestPermission, scheduleLocalNotification } from '../../src/lib/notifications';

type Mode = 'light' | 'dark' | 'system';
const MODES: Mode[] = ['light', 'dark', 'system'];

export default function SettingsScreen() {
  const stationName = useStationStore((s) => s.stationName);
  const stationId = useStationStore((s) => s.stationId);
  const hostUrl = useStationStore((s) => s.hostUrl);
  const connectionType = useStationStore((s) => s.connectionType);
  const isConnected = useStationStore((s) => s.isConnected);
  const disconnect = useStationStore((s) => s.disconnect);
  const { mode, setMode } = useThemeStore();
  // M-7: Tracks whether the OS notification permission has been granted.
  // Server-side push alerts are a future feature — we only request the OS
  // permission here so it is ready when that feature ships.
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  async function handleNotificationsToggle(value: boolean) {
    if (value) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert('Permission required', 'Enable notifications in your device settings.');
        return;
      }
      setNotificationsEnabled(true);
      // Confirm to the user that the permission was granted
      await scheduleLocalNotification(
        'BirdEcho notifications enabled',
        'You will receive rare-species alerts once that feature ships.',
      );
    } else {
      setNotificationsEnabled(false);
    }
  }

  async function handleDisconnect() {
    await disconnect();
    router.replace('/');
  }

  const stationLabel =
    stationName ??
    (connectionType === 'birdnetgo' || connectionType === 'birdnetpi' ? hostUrl : stationId) ??
    '—';
  const stationSubLabel =
    connectionType === 'birdnetgo'
      ? `BirdNET-Go · ${hostUrl ?? ''}`
      : connectionType === 'birdnetpi'
        ? `BirdNET-Pi · ${hostUrl ?? ''}`
        : `BirdWeather · ID ${stationId ?? '—'}`;

  return (
    <View className="flex-1 bg-white dark:bg-gray-950 px-5 pt-6">
      <Text className="mb-6 text-xl font-bold text-gray-900 dark:text-white">Settings</Text>

      {/* Appearance */}
      <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
        Appearance
      </Text>
      <View className="mb-6 flex-row rounded-xl border border-gray-200 overflow-hidden">
        {MODES.map((m) => (
          <Pressable
            key={m}
            className={`flex-1 items-center py-2.5 active:opacity-75 ${
              mode === m ? 'bg-green-700' : 'bg-white dark:bg-gray-900'
            }`}
            onPress={() => setMode(m)}
          >
            <Text
              className={`text-sm font-medium capitalize ${
                mode === m ? 'text-white' : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              {m}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Notifications */}
      <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
        Notifications
      </Text>
      <View className="mb-1 flex-row items-center justify-between rounded-xl border border-gray-200 bg-gray-50 dark:bg-gray-900 px-4 py-3">
        <View className="flex-1 mr-3">
          <Text className="text-sm text-gray-700 dark:text-gray-300">Rare species alerts</Text>
          <Text className="text-xs text-gray-400 mt-0.5">
            Coming soon — grant permission now to opt in early
          </Text>
        </View>
        <Switch
          value={notificationsEnabled}
          onValueChange={handleNotificationsToggle}
          trackColor={{ true: '#15803d' }}
        />
      </View>
      <Text className="mb-6 px-1 text-xs text-gray-400">
        Grants OS permission for future push alerts. No data leaves your device today.
      </Text>

      {/* Station */}
      <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
        Station
      </Text>
      {isConnected ? (
        <View className="rounded-xl border border-gray-200 bg-gray-50 dark:bg-gray-900 p-4">
          <Text
            className="text-base font-semibold text-gray-900 dark:text-white"
            numberOfLines={1}
          >
            {stationLabel}
          </Text>
          <Text className="text-sm text-gray-400 mt-0.5" numberOfLines={1}>
            {stationSubLabel}
          </Text>
          <Pressable
            className="mt-4 items-center rounded-lg border border-red-200 bg-red-50 py-2.5 active:opacity-75"
            onPress={handleDisconnect}
          >
            <Text className="text-sm font-semibold text-red-600">Disconnect station</Text>
          </Pressable>
        </View>
      ) : (
        <View className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <Text className="text-sm text-gray-500">No station connected.</Text>
          <Pressable
            className="mt-3 items-center rounded-lg bg-green-700 py-2.5 active:opacity-75"
            onPress={() => router.push('/connect')}
          >
            <Text className="text-sm font-semibold text-white">Connect a station</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
