import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'nativewind';
import { useStationStore } from '../../src/stores/stationStore';
import { chrome } from '../../src/theme/colors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(active: IoniconName, inactive: IoniconName) {
  const TabIcon = ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} size={22} color={color} />
  );
  TabIcon.displayName = `TabIcon(${active})`;
  return TabIcon;
}

export default function TabsLayout() {
  const stationName = useStationStore((s) => s.stationName);
  const stationsCount = useStationStore((s) => s.stations.length);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Show the active station name as the Feed tab title.
  const feedTitle = stationName ?? 'BirdEcho';

  const ui = chrome(isDark);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ui.tint,
        tabBarInactiveTintColor: ui.inactive,
        headerShown: true,
        headerStyle: { backgroundColor: ui.canvas },
        headerTintColor: ui.text,
        headerTitleStyle: { fontWeight: '700', fontSize: 20 },
        headerTitleAlign: 'left',
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: ui.canvas },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: ui.surface,
          borderTopColor: ui.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: feedTitle,
          tabBarLabel: 'Feed',
          tabBarBadge: stationsCount > 1 ? stationsCount : undefined,
          tabBarIcon: tabIcon('home', 'home-outline'),
        }}
      />
      <Tabs.Screen
        name="species"
        options={{
          title: 'Species',
          tabBarLabel: 'Species',
          tabBarIcon: tabIcon('leaf', 'leaf-outline'),
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favorites',
          tabBarLabel: 'Favorites',
          tabBarIcon: tabIcon('heart', 'heart-outline'),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarLabel: 'Stats',
          tabBarIcon: tabIcon('bar-chart', 'bar-chart-outline'),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarLabel: 'Map',
          tabBarIcon: tabIcon('map', 'map-outline'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: tabIcon('settings', 'settings-outline'),
        }}
      />
    </Tabs>
  );
}
