import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getBaseDeployments, getBases, rememberBaseDeployment, saveBase, type ManagedBase } from '../lib/secureStorage';
import { deploymentFromInfo, fetchStationFeed, remoteWindowStart, resolveDeployment, type BaseRef } from '../lib/remoteFeed';
import { getBaseInfo } from '../lib/baseApi';
import { baseApiUrlFor } from '../lib/baseStation';
import type { Detection } from '../types/birdweather';

export type RemoteFeedState = 'off' | 'loading' | 'ready' | 'unknown' | 'error';

/**
 * The active Base station's detections from Wildlife Network, fetched while the station is out of reach on the
 * local network (`unreachable`). The answer stays cached, so items keep merging (without duplicates) after the
 * station answers again. `state` is 'unknown' when the Base's deployment could not be found.
 * While the station is reachable, the Base's own /api/info tells its deployment, which is remembered for later.
 */
export function useRemoteFeed(baseId: string | undefined, unreachable: boolean, local: Detection[], hostUrl?: string) {
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

  // Reachable: ask the Base itself (Base 0.2.0 and later report deploymentId), at most once a day.
  const reported = useQuery({
    queryKey: ['base-deployment', baseId, hostUrl],
    queryFn: async () => {
      const api = baseApiUrlFor(hostUrl!);
      const d = api ? deploymentFromInfo(await getBaseInfo(api, 4000).catch(() => null), baseId!) : null;
      if (d) await rememberBaseDeployment(baseId!, d);
      return d;
    },
    enabled: !!baseId && !!hostUrl && !unreachable,
    staleTime: 24 * 3600_000,
    retry: false,
  });

  const deployment = useQuery({
    queryKey: ['wn-deployment', baseId],
    queryFn: async () => {
      // What the Base reported about itself beats an id found by searching earlier.
      const remembered = (await getBaseDeployments())[baseId!];
      const ref: BaseRef | null = base ?? (remembered ? {} : null);
      const d = await resolveDeployment(ref ? { ...ref, deploymentId: remembered ?? ref.deploymentId } : null, local);
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

  const deploymentId = reported.data ?? deployment.data ?? base?.deploymentId ?? null;
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
