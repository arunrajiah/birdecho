import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { ApiError } from '../lib/apiClient';

interface Props {
  error: Error | null;
  onRetry: () => void;
  /** Friendly noun for what failed, e.g. "sightings" or "stats" */
  subject?: string;
}

export default function ErrorState({ error, onRetry, subject = 'data' }: Props) {
  const isAuth = error instanceof ApiError && error.isAuthError;

  if (isAuth) {
    return (
      <View className="flex-1 items-center justify-center bg-white gap-4 px-8">
        <Text className="text-4xl">🔑</Text>
        <Text className="text-center text-base font-semibold text-gray-800">
          Your token has expired or is no longer valid.
        </Text>
        <Text className="text-center text-sm text-gray-500">
          Reconnect your station to continue.
        </Text>
        <Pressable
          className="mt-2 rounded-xl bg-green-700 px-6 py-3 active:opacity-75"
          onPress={() => router.replace('/connect')}
        >
          <Text className="font-semibold text-white">Reconnect station</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-white gap-4 px-6">
      <Text className="text-center text-base text-gray-600">
        Could not load {subject}. Check your connection and try again.
      </Text>
      <Pressable
        className="rounded-xl bg-green-700 px-6 py-3 active:opacity-75"
        onPress={onRetry}
      >
        <Text className="font-semibold text-white">Retry</Text>
      </Pressable>
    </View>
  );
}
