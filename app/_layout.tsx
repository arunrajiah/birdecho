import '../global.css';
import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useColorScheme } from 'nativewind';
import { useStationStore } from '../src/stores/stationStore';
import { useFavoritesStore } from '../src/stores/favoritesStore';
import { useThemeStore } from '../src/stores/themeStore';
import { initSentry } from '../src/lib/sentry';

initSentry();

const queryClient = new QueryClient();

export default function RootLayout() {
  const hydrateStation = useStationStore((s) => s.hydrate);
  const hydrateFavorites = useFavoritesStore((s) => s.hydrate);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const themeMode = useThemeStore((s) => s.mode);
  const { setColorScheme } = useColorScheme();
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    hydrateStation().catch(console.error);
    hydrateFavorites().catch(console.error);
    hydrateTheme().catch(console.error);
  }, [hydrateStation, hydrateFavorites, hydrateTheme]);

  useEffect(() => {
    setColorScheme(themeMode);
  }, [themeMode, setColorScheme]);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Perch', headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="connect" options={{ title: 'Connect station', presentation: 'modal' }} />
        <Stack.Screen name="record/[id]" options={{ title: 'Sighting' }} />
        <Stack.Screen name="species/[id]" options={{ title: 'Species' }} />
      </Stack>
    </QueryClientProvider>
  );
}
