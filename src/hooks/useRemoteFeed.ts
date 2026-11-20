import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getBases, saveBase, type ManagedBase } from '../lib/secureStorage';
import { fetchStationFeed, remoteWindowStart, resolveDeployment } from '../lib/remoteFeed';
import type { Detection } from '../types/birdweather';

export type RemoteFeedState = 'off' | 'loading' | 'ready' | 'unknown' | 'error';

/**
 * The active Base station's detections from Wildlife Network, fetched while the station is out of reach on the
 * local network (`unreachable`). The answer stays cached, so items keep merging (without duplicates) after the
 * station answers again. `state` is 'unknown' when the Base's deployment could not be found.
 */
export function useRemoteFeed(baseId: string | undefined, unreachable: boolean, local: Detection[]) {
  const [base, setBase] = useState<ManagedBase | null | undefined>(undefined);

  useEffect(() => {
    setBase(undefined);
    if (!baseId) return;
    let live = true;
    void getBases().then((all) => {
      if (live) setBase(all.find((b) => b.hardwareId === baseId) ?? null);
    });
    return () => {
      live = false;
    };
  }, [baseId]);

  const deployment = useQuery({
    queryKey: ['wn-deployment', baseId],
    queryFn: async () => {
      const d = await resolveDeployment(base ?? null, local);
      if (d && base && base.deploymentId !== d) {
        const updated = { ...base, deploymentId: d };
        await saveBase(updated);
        setBase(updated);
      }
      return d;
    },
    enabled: !!baseId && unreachable && base !== undefined,
    staleTime: 30 * 60_000,
  });

  const deploymentId = base?.deploymentId ?? deployment.data ?? null;
  const hasKey = !!base?.apiKey;
  const feed = useQuery({
    queryKey: ['wn-feed', deploymentId, hasKey],
    queryFn: () => fetchStationFeed(deploymentId!, { from: remoteWindowStart(local), apiKey: base?.apiKey }),
    enabled: !!deploymentId && unreachable,
    refetchInterval: unreachable ? 5 * 60_000 : false,
    staleTime: 60_000,
  });

  let state: RemoteFeedState = 'off';
  if (unreachable) {
    if (base === undefined || deployment.isLoading || feed.isLoading) state = 'loading';
    else if (!deploymentId) state = 'unknown';
    else if (feed.isError && !feed.data) state = 'error';
    else state = 'ready';
  }
  return { records: feed.data ?? [], state, hasKey };
}
