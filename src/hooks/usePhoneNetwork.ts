import { useEffect, useState } from 'react';
import type { PhoneNetwork } from '../lib/reachability';

type ExpoNetwork = typeof import('expo-network');

// expo-network is a native module: a build made before it was added has no copy of it, so load it defensively and
// fall back to "unknown" (the Feed then waits for the station's own request, which has a short timeout).
let Network: ExpoNetwork | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Network = require('expo-network') as ExpoNetwork;
} catch {
  Network = null;
}

/**
 * The phone's connection type and, on Wi-Fi, its IPv4 address. Null until known. Follows changes (Wi-Fi to mobile
 * data and back). Needs no extra permission or entitlement.
 */
export function usePhoneNetwork(): PhoneNetwork | null {
  const [net, setNet] = useState<PhoneNetwork | null>(null);

  useEffect(() => {
    const N = Network;
    if (!N) return;
    let live = true;
    const update = async (s: { type?: string; isConnected?: boolean }) => {
      const wifi = s.type === N.NetworkStateType.WIFI || s.type === N.NetworkStateType.ETHERNET;
      const ip = wifi ? await N.getIpAddressAsync().catch(() => null) : null;
      const next = { type: s.type ?? null, isConnected: s.isConnected ?? null, ip };
      // The listener can repeat the same state: keep the old object so the Feed does not re-render for nothing.
      if (live) setNet((prev) => (prev && prev.type === next.type && prev.isConnected === next.isConnected && prev.ip === next.ip ? prev : next));
    };
    N.getNetworkStateAsync().then(update, () => {
      if (live) setNet({ type: 'UNKNOWN' });
    });
    const sub = N.addNetworkStateListener((s) => void update(s));
    return () => {
      live = false;
      sub.remove();
    };
  }, []);

  return net;
}
