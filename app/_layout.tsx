import '../global.css';
import { useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';
import { useStationStore } from '../src/stores/stationStore';
import { syncStationToWatch } from '../src/lib/wearSync';
import { useFavoritesStore } from '../src/stores/favoritesStore';
import { useThemeStore } from '../src/stores/themeStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useRareStore } from '../src/stores/rareStore';
import { initSentry, captureException } from '../src/lib/sentry';
import { QUERY_CACHE_STORAGE_KEY } from '../src/lib/queryCache';
import { chrome } from '../src/theme/colors';
import { StatusBar } from 'expo-status-bar';

initSentry();

// Cache is kept for 24 hours. Queries marked with gcTime > 0 are persisted.
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep data in the in-memory cache for 5 minutes; the persisted cache
      // extends this to 24 hours while the app is closed.
      staleTime: 5 * 60 * 1000,
      gcTime: CACHE_MAX_AGE_MS,
    },
  },
});

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: QUERY_CACHE_STORAGE_KEY,
  // Throttle writes to AsyncStorage — at most once every 2 seconds
  throttleTime: 2000,
});

export default function RootLayout() {
  const hydrateStation = useStationStore((s) => s.hydrate);
  const hydrateFavorites = useFavoritesStore((s) => s.hydrate);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  const hydrateRare = useRareStore((s) => s.hydrate);
  const themeMode = useThemeStore((s) => s.mode);
  const { colorScheme, setColorScheme } = useColorScheme();
  const hydrated = useRef(false);
  const [stationsReady, setStationsReady] = useState(false);
  const activeStation = useStationStore(
    (st) => st.stations.find((x) => x.id === st.activeStationId) ?? null,
  );

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    hydrateStation()
      .then(() => setStationsReady(true))
      .catch(captureException);
    hydrateFavorites().catch(captureException);
    hydrateTheme().catch(captureException);
    hydrateSettings().catch(captureException);
    hydrateRare().catch(captureException);
  }, [hydrateStation, hydrateFavorites, hydrateTheme, hydrateSettings, hydrateRare]);

  // Keep the Wear OS app pointed at the active station. Waits for hydration so
  // the empty pre-hydrate state is never mistaken for "no station".
  useEffect(() => {
    if (!stationsReady) return;
    void syncStationToWatch(activeStation);
  }, [stationsReady, activeStation]);

  useEffect(() => {
    setColorScheme(themeMode);
  }, [themeMode, setColorScheme]);

  const isDark = colorScheme === 'dark';
  const ui = chrome(isDark);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncStoragePersister,
        maxAge: CACHE_MAX_AGE_MS,
        // Queries whose key starts with 'offline-skip' bypass persistence
        // (e.g. one-off mutations or sensitive data we don't want cached)
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            query.state.status === 'success' &&
            !String(query.queryKey[0]).startsWith('offline-skip'),
        },
      }}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: ui.canvas },
          headerTintColor: ui.text,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: ui.canvas },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'BirdEcho', headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="connect" options={{ title: 'Connect station', presentation: 'modal' }} />
        <Stack.Screen name="record/[id]" options={{ title: 'Sighting' }} />
        <Stack.Screen name="species/[id]" options={{ title: 'Species' }} />
        <Stack.Screen name="wildnetwork" options={{ title: 'WildNetwork' }} />
      </Stack>
    </PersistQueryClientProvider>
  );
}
