import { create } from 'zustand';
import * as secureStorage from '../lib/secureStorage';

export type ConnectionType = 'birdweather' | 'birdnetgo' | 'birdnetpi';

interface StationState {
  /** BirdWeather station ID (numeric string). Only set for birdweather connections. */
  stationId: string | null;
  stationName: string | null;
  stationTimezone: string | null;
  /** Host URL (BirdNET-Go / BirdNET-Pi). Only set for direct-connection modes. */
  hostUrl: string | null;
  connectionType: ConnectionType;
  loading: boolean;

  /** True when a station is configured (any connection type). */
  isConnected: boolean;

  hydrate: () => Promise<void>;
  connectBirdWeather: (token: string, stationId: string, stationName: string, timezone?: string) => Promise<void>;
  connectBirdNetGo: (hostUrl: string, stationName?: string) => Promise<void>;
  connectBirdNetPi: (hostUrl: string, stationName?: string) => Promise<void>;
  disconnect: () => Promise<void>;
}

export const useStationStore = create<StationState>((set) => ({
  stationId: null,
  stationName: null,
  stationTimezone: null,
  hostUrl: null,
  connectionType: 'birdweather',
  loading: false,
  isConnected: false,

  hydrate: async () => {
    set({ loading: true });
    const [stationId, stationTimezone, hostUrl, connectionType] = await Promise.all([
      secureStorage.getStationId(),
      secureStorage.getTimezone(),
      secureStorage.getHostUrl(),
      secureStorage.getConnectionType(),
    ]);
    const type = (connectionType ?? 'birdweather') as ConnectionType;
    const connected =
      type === 'birdnetgo' || type === 'birdnetpi' ? !!hostUrl : !!stationId;
    set({ stationId, stationTimezone, hostUrl, connectionType: type, isConnected: connected, loading: false });
  },

  connectBirdWeather: async (token, stationId, stationName, timezone) => {
    await Promise.all([
      secureStorage.setToken(token),
      secureStorage.setStationId(stationId),
      secureStorage.setConnectionType('birdweather'),
      ...(timezone ? [secureStorage.setTimezone(timezone)] : []),
    ]);
    set({
      stationId,
      stationName,
      stationTimezone: timezone ?? null,
      hostUrl: null,
      connectionType: 'birdweather',
      isConnected: true,
    });
  },

  connectBirdNetGo: async (hostUrl, stationName) => {
    await Promise.all([
      secureStorage.setHostUrl(hostUrl),
      secureStorage.setConnectionType('birdnetgo'),
    ]);
    set({
      hostUrl,
      stationName: stationName ?? hostUrl,
      stationId: null,
      stationTimezone: null,
      connectionType: 'birdnetgo',
      isConnected: true,
    });
  },

  connectBirdNetPi: async (hostUrl, stationName) => {
    await Promise.all([
      secureStorage.setHostUrl(hostUrl),
      secureStorage.setConnectionType('birdnetpi'),
    ]);
    set({
      hostUrl,
      stationName: stationName ?? hostUrl,
      stationId: null,
      stationTimezone: null,
      connectionType: 'birdnetpi',
      isConnected: true,
    });
  },

  disconnect: async () => {
    await Promise.all([
      secureStorage.clearToken(),
      secureStorage.clearStationId(),
      secureStorage.clearTimezone(),
      secureStorage.clearHostUrl(),
      secureStorage.clearConnectionType(),
    ]);
    set({
      stationId: null,
      stationName: null,
      stationTimezone: null,
      hostUrl: null,
      connectionType: 'birdweather',
      isConnected: false,
    });
  },
}));
