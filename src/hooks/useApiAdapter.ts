import { useMemo } from 'react';
import { useStationStore } from '../stores/stationStore';
import { createBirdWeatherAdapter } from '../api/adapters/birdweather';
import { createBirdNetGoAdapter } from '../api/adapters/birdnetgo';
import { createBirdNetPiAdapter } from '../api/adapters/birdnetpi';
import type { StationAdapter } from '../api/adapter';

/**
 * Returns the correct StationAdapter for the active connection.
 * Returns null when no station is connected.
 *
 * Re-creates the adapter whenever the active station changes so that React
 * Query cache keys (which include `adapter.cacheKey`) invalidate automatically
 * when the user switches stations.
 */
export function useApiAdapter(): StationAdapter | null {
  const connectionType = useStationStore((s) => s.connectionType);
  const stationId = useStationStore((s) => s.stationId);
  const hostUrl = useStationStore((s) => s.hostUrl);
  // Include activeStationId so the adapter re-creates when the user switches
  // between two stations that share the same connectionType/stationId/hostUrl
  // (unlikely in practice, but correct in principle).
  const activeStationId = useStationStore((s) => s.activeStationId);

  return useMemo(() => {
    if (connectionType === 'birdnetgo' && hostUrl) {
      return createBirdNetGoAdapter(hostUrl);
    }
    if (connectionType === 'birdnetpi' && hostUrl) {
      return createBirdNetPiAdapter(hostUrl);
    }
    if (stationId) {
      return createBirdWeatherAdapter(stationId);
    }
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionType, stationId, hostUrl, activeStationId]);
}
