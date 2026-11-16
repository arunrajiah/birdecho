import { View, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchLastReport } from '../lib/wildnetwork';

function ago(t: Date): string {
  const m = Math.max(0, Math.round((Date.now() - t.getTime()) / 60_000));
  if (m < 2) return 'just now';
  if (m < 90) return `${m} minutes ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} hours ago` : `${Math.round(h / 24)} days ago`;
}

/** "Is my Pi sending?": when the station's agent last reported to Wildlife Network, checked every minute. */
export default function StationStatus({ deviceId }: { deviceId: string }) {
  const { data, isError, isLoading } = useQuery({
    queryKey: ['wildnetwork', 'device', deviceId],
    queryFn: () => fetchLastReport(deviceId),
    refetchInterval: 60_000,
  });
  // The agent reports every 15 minutes; an hour without a report means it has stopped.
  const fresh = data ? Date.now() - data.getTime() < 60 * 60_000 : false;
  const [dot, text] = isLoading ? ['bg-gray-300', 'Checking the station...']
    : isError ? ['bg-gray-300', 'Wildlife Network is not reachable right now.']
    : !data ? ['bg-amber-500', 'Not heard from yet. After you run the command, the first report arrives within a few minutes.']
    : fresh ? ['bg-green-600', `Sending. Last report ${ago(data)}.`]
    : ['bg-red-500', `Last report ${ago(data)}. Check that the Pi is on and online; the agent log is on the Pi: journalctl -u wdx-agent`];
  return (
    <View className="mb-6 flex-row items-start gap-2.5 rounded-2xl bg-white dark:bg-gray-900 p-4">
      <View className={`mt-1 h-2.5 w-2.5 rounded-full ${dot}`} />
      <Text className="flex-1 text-sm text-gray-700 dark:text-gray-200">{text}</Text>
    </View>
  );
}
