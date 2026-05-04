import { useMemo } from 'react';
import { useStationStore } from '../stores/stationStore';
import { createBirdWeatherAdapter } from '../api/adapters/birdweather';
import { createBirdNetGoAdapter } from '../api/adapters/birdnetgo';
import { createBirdNetPiAdapter } from '../api/adapters/birdnetpi';
import type { StationAdapter } from '../api/adapter';

/**
 * Returns the correct StationAdapter for the active connection.
 * Returns null when no station is connected.
 */
export function useApiAdapter(): StationAdapter | null {
  const connectionType = useStationStore((s) => s.connectionType);
  const stationId = useStationStore((s) => s.stationId);
  const hostUrl = useStationStore((s) => s.hostUrl);

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
  }, [connectionType, stationId, hostUrl]);
}
