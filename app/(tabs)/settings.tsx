import { View, Text, Pressable, Switch, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useStationStore } from '../../src/stores/stationStore';
import { useThemeStore } from '../../src/stores/themeStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { requestPermission } from '../../src/lib/notifications';
import type { SavedStation } from '../../src/types/station';
import { wildNetworkSource } from '../../src/lib/wildnetwork';

type Mode = 'light' | 'dark' | 'system';
const MODES: Mode[] = ['light', 'dark', 'system'];

const CONNECTION_LABEL: Record<string, string> = {
  birdweather: 'BirdWeather',
  birdnetgo: 'BirdNET-Go',
  birdnetpi: 'BirdNET-Pi',
  demo: 'Demo',
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
      ? `${typeLabel} · ID ${station.bwStationId ?? '?'}`
      : station.hostUrl
        ? `${typeLabel} · ${station.hostUrl}`
        : `${typeLabel} · sample data`;

  return (
    <Pressable
      className={`flex-row items-center px-4 py-3 active:opacity-80 ${
        isActive ? 'bg-green-50 dark:bg-green-950' : ''
      }`}
      onPress={onSwitch}
    >
      {/* Active indicator */}
      <View
        className={`mr-3 h-2.5 w-2.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
      />

      {/* Station info */}
      <View className="flex-1">
        <Text
          className={`text-sm font-semibold ${
            isActive ? 'text-green-800 dark:text-green-300' : 'text-gray-900 dark:text-gray-50'
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
  const activeType = useStationStore((s) => s.connectionType);

  const { mode, setMode } = useThemeStore();
  const rareAlertsEnabled = useSettingsStore((s) => s.rareAlertsEnabled);
  const setRareAlerts = useSettingsStore((s) => s.setRareAlerts);

  async function handleRareAlertsToggle(value: boolean) {
    if (value) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert('Permission required', 'Enable notifications in your device settings.');
        return;
      }
      setRareAlerts(true);
    } else {
      setRareAlerts(false);
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
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-950">
      <View className="px-4 pt-2 pb-8">

        {/* ── Appearance ──────────────────────────────────────────────────── */}
        <Text className="mb-2 ml-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Appearance
        </Text>
        <View className="mb-6 flex-row rounded-2xl bg-gray-200 dark:bg-gray-800 p-1">
          {MODES.map((m) => (
            <Pressable
              key={m}
              className={`flex-1 items-center rounded-xl py-2.5 active:opacity-75 ${
                mode === m ? 'bg-white dark:bg-gray-600' : ''
              }`}
              onPress={() => setMode(m)}
            >
              <Text
                className={`text-sm font-medium capitalize ${
                  mode === m ? 'text-gray-900 dark:text-gray-50' : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                {m}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Notifications ────────────────────────────────────────────────── */}
        <Text className="mb-2 ml-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Notifications
        </Text>
        <View className="mb-1 flex-row items-center justify-between rounded-2xl bg-white dark:bg-gray-900 px-4 py-3">
          <View className="flex-1 mr-3">
            <Text className="text-[15px] font-medium text-gray-900 dark:text-gray-50">Rare species alerts</Text>
            <Text className="text-xs text-gray-400 mt-0.5">
              Notify me when a species I marked as rare is detected
            </Text>
          </View>
          <Switch
            value={rareAlertsEnabled}
            onValueChange={handleRareAlertsToggle}
            trackColor={{ true: '#347F57' }}
          />
        </View>
        <Text className="mb-6 px-1 text-xs text-gray-400">
          Mark species as rare from their detail page (⚑). This fires a local notification the
          first time each one is detected per day. No data leaves your device.
        </Text>

        {/* ── WildNetwork ──────────────────────────────────────────────────── */}
        {isConnected && wildNetworkSource(activeType) && (
          <>
            <Text className="mb-2 ml-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              WildNetwork
            </Text>
            <Pressable
              className="mb-6 rounded-2xl bg-white dark:bg-gray-900 px-4 py-3.5 active:opacity-75"
              onPress={() => router.push('/wildnetwork')}
            >
              <Text className="text-[15px] font-medium text-gray-900 dark:text-gray-50">Share this station with WildNetwork</Text>
              <Text className="text-xs text-gray-400 mt-0.5">
                Add your detections to the open map of where birds are moving
              </Text>
            </Pressable>
          </>
        )}

        {/* ── Stations ─────────────────────────────────────────────────────── */}
        <Text className="mb-2 ml-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Stations
        </Text>

        {isConnected && stations.length > 0 ? (
          <View className="mb-3 rounded-2xl bg-white dark:bg-gray-900 overflow-hidden">
            {stations.map((station, idx) => (
              <View key={station.id}>
                {idx > 0 && <View className="h-px bg-gray-100 dark:bg-gray-800 ml-9" />}
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
          <View className="mb-3 rounded-2xl bg-white dark:bg-gray-900 p-4">
            <Text className="text-sm text-gray-500 dark:text-gray-400">No stations connected.</Text>
          </View>
        )}

        {/* Add station */}
        <Pressable
          className="mb-3 flex-row items-center justify-center rounded-2xl bg-green-700 py-3.5 active:opacity-75"
          onPress={() => router.push('/connect')}
        >
          <Text className="text-sm font-semibold text-white">+ Add station</Text>
        </Pressable>

        {/* Disconnect all — only show when connected */}
        {isConnected ? (
          <Pressable
            className="items-center rounded-2xl bg-white dark:bg-gray-900 py-3.5 active:opacity-75"
            onPress={confirmDisconnectAll}
          >
            <Text className="text-sm font-semibold text-red-600 dark:text-red-300">Disconnect all stations</Text>
          </Pressable>
        ) : null}

        {/* Version footer */}
        <Text className="mt-8 text-center text-xs text-gray-400 dark:text-gray-600">
          BirdEcho v{Constants.expoConfig?.version ?? '?'}
          {Constants.expoConfig?.android?.versionCode ? ` (${Constants.expoConfig.android.versionCode})` : ''}
        </Text>
      </View>
    </ScrollView>
  );
}
