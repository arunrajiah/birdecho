import { View, Text, Pressable, ScrollView } from 'react-native';
import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStationStore } from '../src/stores/stationStore';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface Choice {
  icon: IoniconName;
  title: string;
  detail: string;
  href?: Href;
  action?: 'demo';
}

/** "What do you have?" Every path ends on the same home screen; Settings reuses this screen as "Add a device". */
const CHOICES: Choice[] = [
  {
    icon: 'hardware-chip-outline',
    title: 'Wildlife Network Base',
    detail: 'Set up a Base: join its Wi-Fi, give it a name and a place, and it starts sharing.',
    href: '/add-base',
  },
  {
    icon: 'cloud-outline',
    title: 'BirdWeather station',
    detail: 'A PUC, or a BirdNET-Pi or BirdNET-Go that uploads to BirdWeather.',
    href: { pathname: '/connect', params: { type: 'birdweather' } },
  },
  {
    icon: 'radio-outline',
    title: 'BirdNET-Pi',
    detail: 'A Raspberry Pi running BirdNET-Pi on your home network.',
    href: { pathname: '/connect', params: { type: 'birdnetpi' } },
  },
  {
    icon: 'pulse-outline',
    title: 'BirdNET-Go',
    detail: 'BirdNET-Go on a Pi, mini PC or NAS on your home network.',
    href: { pathname: '/connect', params: { type: 'birdnetgo' } },
  },
  {
    icon: 'construct-outline',
    title: 'My own (DIY) device',
    detail: 'Something you built that identifies wildlife. Get a key to send its detections to Wildlife Network.',
    href: '/add-diy',
  },
  {
    icon: 'leaf-outline',
    title: 'Nothing yet',
    detail: 'Look around with sample data and see what is arriving near you.',
    action: 'demo',
  },
];

export default function OnboardingScreen() {
  const connectDemo = useStationStore((s) => s.connectDemo);
  const isFirst = useStationStore((s) => s.stations.length === 0);

  async function choose(c: Choice) {
    if (c.action === 'demo') {
      await connectDemo();
      router.replace('/(tabs)');
      return;
    }
    if (c.href) router.push(c.href);
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-950" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text className="text-[28px] font-bold text-gray-900 dark:text-gray-50">What do you have?</Text>
      <Text className="mt-1 mb-5 text-sm text-gray-600 dark:text-gray-300">
        {isFirst
          ? 'Pick what you want to connect. You can add more devices later in Settings.'
          : 'Pick the device to add.'}
      </Text>
      {CHOICES.map((c) => (
        <Pressable
          key={c.title}
          accessibilityRole="button"
          accessibilityLabel={`${c.title}. ${c.detail}`}
          className="mb-3 flex-row items-center gap-3 rounded-2xl bg-white dark:bg-gray-900 p-4 active:opacity-80"
          onPress={() => void choose(c)}
        >
          <View className="h-11 w-11 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900">
            <Ionicons name={c.icon} size={22} color="#347F57" />
          </View>
          <View className="flex-1">
            <Text className="text-[15px] font-semibold text-gray-900 dark:text-gray-50">{c.title}</Text>
            <Text className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{c.detail}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9C978B" />
        </Pressable>
      ))}
    </ScrollView>
  );
}
