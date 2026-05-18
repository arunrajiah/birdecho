import AsyncStorage from '@react-native-async-storage/async-storage';

/** AsyncStorage key used by PersistQueryClientProvider in app/_layout.tsx. */
export const QUERY_CACHE_STORAGE_KEY = 'birdecho-query-cache';

/**
 * Remove the React Query persisted cache from AsyncStorage.
 *
 * Call this whenever the user disconnects all stations so that cached
 * detections from a previous station cannot survive a reconnect and
 * crash the feed on the next open.
 */
export async function clearQueryCache(): Promise<void> {
  await AsyncStorage.removeItem(QUERY_CACHE_STORAGE_KEY);
}
