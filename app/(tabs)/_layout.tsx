import { Tabs } from 'expo-router';
import { useStationStore } from '../../src/stores/stationStore';

export default function TabsLayout() {
  const stationName = useStationStore((s) => s.stationName);
  const stationsCount = useStationStore((s) => s.stations.length);

  // Show the active station name as the Feed tab title.
  const feedTitle = stationName ?? 'BirdEcho';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#15803d',
        tabBarInactiveTintColor: '#9ca3af',
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: feedTitle,
          tabBarLabel: 'Feed',
          tabBarBadge: stationsCount > 1 ? stationsCount : undefined,
        }}
      />
      <Tabs.Screen
        name="species"
        options={{ title: 'Species', tabBarLabel: 'Species' }}
      />
      <Tabs.Screen
        name="favorites"
        options={{ title: 'Favorites', tabBarLabel: 'Favorites' }}
      />
      <Tabs.Screen
        name="stats"
        options={{ title: 'Stats', tabBarLabel: 'Stats' }}
      />
      <Tabs.Screen
        name="map"
        options={{ title: 'Map', tabBarLabel: 'Map' }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarLabel: 'Settings' }}
      />
    </Tabs>
  );
}
