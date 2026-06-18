import { View, Text, Pressable, Linking } from 'react-native';
import { useAppUpdate } from '../hooks/useAppUpdate';
import { RELEASES_PAGE } from '../lib/appUpdate';

/**
 * Launch-time "update available" banner for sideloaded Android builds.
 * Renders nothing when there is no newer release or the user dismissed it.
 */
export default function UpdateBanner() {
  const { update, installing, progress, error, install, dismiss } = useAppUpdate();

  if (!update) return null;

  const pct = Math.round(progress * 100);

  return (
    <View className="border-b border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 px-4 py-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-sm font-semibold text-green-900 dark:text-green-200">
            Update available — v{update.latestVersion}
          </Text>
          <Text className="text-xs text-green-700 dark:text-green-400 mt-0.5">
            You have v{update.currentVersion}
          </Text>
        </View>
        {!installing ? (
          <Pressable hitSlop={8} onPress={dismiss} className="px-1 active:opacity-60">
            <Text className="text-lg leading-none text-green-700 dark:text-green-400">×</Text>
          </Pressable>
        ) : null}
      </View>

      {installing ? (
        <View className="mt-3">
          <View className="h-2 w-full overflow-hidden rounded-full bg-green-200 dark:bg-green-900">
            <View
              className="h-2 rounded-full bg-green-600"
              style={{ width: `${Math.max(pct, 3)}%` }}
            />
          </View>
          <Text className="mt-1 text-xs text-green-700 dark:text-green-400">
            Downloading… {pct}%
          </Text>
        </View>
      ) : (
        <View className="mt-3 flex-row items-center gap-3">
          <Pressable
            className="rounded-lg bg-green-700 px-4 py-2 active:opacity-75"
            onPress={install}
          >
            <Text className="text-sm font-semibold text-white">Download &amp; install</Text>
          </Pressable>
          <Pressable
            className="px-2 py-2 active:opacity-60"
            onPress={() => Linking.openURL(RELEASES_PAGE)}
          >
            <Text className="text-sm text-green-700 dark:text-green-400">View release</Text>
          </Pressable>
        </View>
      )}

      {error ? (
        <Text className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</Text>
      ) : null}
    </View>
  );
}
