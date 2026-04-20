import { Tabs } from 'expo-router';

export default function TabsLayout() {
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
        options={{ title: 'Feed', tabBarLabel: 'Feed' }}
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
        name="settings"
        options={{ title: 'Settings', tabBarLabel: 'Settings' }}
      />
    </Tabs>
  );
}
