import { useState } from 'react';
import { View, Text, Pressable, Switch, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useStationStore } from '../../src/stores/stationStore';
import { useThemeStore } from '../../src/stores/themeStore';
import { requestPermission, scheduleLocalNotification } from '../../src/lib/notifications';
import type { SavedStation } from '../../src/types/station';

type Mode = 'light' | 'dark' | 'system';
const MODES: Mode[] = ['light', 'dark', 'system'];

const CONNECTION_LABEL: Record<string, string> = {
  birdweather: 'BirdWeather',
  birdnetgo: 'BirdNET-Go',
  birdnetpi: 'BirdNET-Pi',
};

function StationRow({
  station,
  isActive,
  onSwitch,
  onRemove,
}: {
  station: SavedStation;
  isActive: boolean;
  onSwitch: () => void;
  onRemove: () => void;
}) {
  const typeLabel = CONNECTION_LABEL[station.connectionType] ?? station.connectionType;
  const subLabel =
    station.connectionType === 'birdweather'
      ? `${typeLabel} · ID ${station.bwStationId ?? '—'}`
      : `${typeLabel} · ${station.hostUrl ?? '—'}`;

  return (
    <Pressable
      className={`flex-row items-center px-4 py-3 active:bg-gray-50 ${
        isActive ? 'bg-green-50' : 'bg-white'
      }`}
      onPress={onSwitch}
    >
      {/* Active indicator */}
      <View
        className={`mr-3 h-2.5 w-2.5 rounded-full ${isActive ? 'bg-green-600' : 'bg-gray-200'}`}
      />

      {/* Station info */}
      <View className="flex-1">
        <Text
          className={`text-sm font-semibold ${
            isActive ? 'text-green-800' : 'text-gray-900'
          }`}
          numberOfLines={1}
        >
          {station.stationName}
        </Text>
        <Text className="text-xs text-gray-400 mt-0.5" numberOfLines={1}>
          {subLabel}
        </Text>
      </View>

      {/* Remove button */}
      <Pressable
        className="ml-3 px-2 py-1 active:opacity-60"
        hitSlop={8}
        onPress={onRemove}
      >
        <Text className="text-xs font-medium text-red-500">Remove</Text>
      </Pressable>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const stations = useStationStore((s) => s.stations);
  const activeStationId = useStationStore((s) => s.activeStationId);
  const switchStation = useStationStore((s) => s.switchStation);
  const removeStation = useStationStore((s) => s.removeStation);
  const disconnect = useStationStore((s) => s.disconnect);
  const isConnected = useStationStore((s) => s.isConnected);

  const { mode, setMode } = useThemeStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  async function handleNotificationsToggle(value: boolean) {
    if (value) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert('Permission required', 'Enable notifications in your device settings.');
        return;
      }
      setNotificationsEnabled(true);
      await scheduleLocalNotification(
        'BirdEcho notifications enabled',
        'You will receive rare-species alerts once that feature ships.',
      );
    } else {
      setNotificationsEnabled(false);
    }
  }

  function confirmRemove(station: SavedStation) {
    Alert.alert(
      'Remove station',
      `Remove "${station.stationName}" from BirdEcho?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeStation(station.id);
            // If the last station was removed, go back to the home screen.
            if (stations.length === 1) {
              router.replace('/');
            }
          },
        },
      ],
    );
  }

  function confirmDisconnectAll() {
    Alert.alert(
      'Disconnect all stations',
      'This removes all saved stations and returns to the welcome screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect all',
          style: 'destructive',
          onPress: async () => {
            await disconnect();
            router.replace('/');
          },
        },
      ],
    );
  }

  return (
    <ScrollView className="flex-1 bg-white dark:bg-gray-950">
      <View className="px-5 pt-6 pb-8">
        <Text className="mb-6 text-xl font-bold text-gray-900 dark:text-white">Settings</Text>

        {/* ── Appearance ──────────────────────────────────────────────────── */}
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

        {/* ── Notifications ────────────────────────────────────────────────── */}
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

        {/* ── Stations ─────────────────────────────────────────────────────── */}
        <Text className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
          Stations
        </Text>

        {isConnected && stations.length > 0 ? (
          <View className="mb-3 rounded-xl border border-gray-200 overflow-hidden">
            {stations.map((station, idx) => (
              <View key={station.id}>
                {idx > 0 && <View className="h-px bg-gray-100 ml-9" />}
                <StationRow
                  station={station}
                  isActive={station.id === activeStationId}
                  onSwitch={() => {
                    if (station.id !== activeStationId) {
                      void switchStation(station.id);
                    }
                  }}
                  onRemove={() => confirmRemove(station)}
                />
              </View>
            ))}
          </View>
        ) : (
          <View className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <Text className="text-sm text-gray-500">No stations connected.</Text>
          </View>
        )}

        {/* Add station */}
        <Pressable
          className="mb-3 flex-row items-center justify-center rounded-xl bg-green-700 py-3 active:opacity-75"
          onPress={() => router.push('/connect')}
        >
          <Text className="text-sm font-semibold text-white">+ Add station</Text>
        </Pressable>

        {/* Disconnect all — only show when connected */}
        {isConnected ? (
          <Pressable
            className="items-center rounded-xl border border-red-200 bg-red-50 py-3 active:opacity-75"
            onPress={confirmDisconnectAll}
          >
            <Text className="text-sm font-semibold text-red-600">Disconnect all stations</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}
