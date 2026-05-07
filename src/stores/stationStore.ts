import { create } from 'zustand';
import * as storage from '../lib/secureStorage';
import type { ConnectionType, SavedStation } from '../types/station';

// Re-export ConnectionType so existing imports from this module still work.
export type { ConnectionType };

// ─── Derived-field helper ─────────────────────────────────────────────────────

/**
 * Compute the backwards-compatible flat fields from the active station entry.
 * All existing consumers use `useStationStore((s) => s.stationName)` etc.;
 * this keeps those selectors working without changes.
 */
function deriveActive(stations: SavedStation[], activeId: string | null) {
  const active = stations.find((s) => s.id === activeId) ?? null;
  return {
    isConnected: active !== null,
    stationName: active?.stationName ?? null,
    /** BirdWeather numeric station ID — null for direct connections. */
    stationId: active?.bwStationId ?? null,
    stationTimezone: active?.stationTimezone ?? null,
    hostUrl: active?.hostUrl ?? null,
    connectionType: (active?.connectionType ?? 'birdweather') as ConnectionType,
  };
}

// ─── State interface ──────────────────────────────────────────────────────────

interface StationState {
  /** All saved stations. */
  stations: SavedStation[];
  /** App-internal ID of the station currently being viewed. */
  activeStationId: string | null;
  /** True while the initial hydrate is running. */
  loading: boolean;

  // Backwards-compatible derived fields for the active station:
  isConnected: boolean;
  stationName: string | null;
  stationId: string | null;
  stationTimezone: string | null;
  hostUrl: string | null;
  connectionType: ConnectionType;

  // ── Actions ──────────────────────────────────────────────────────────────
  /**
   * Read persisted state on app startup.  Also migrates v0.1–v0.3 single-station
   * storage format to the new multi-station format.
   */
  hydrate: () => Promise<void>;

  /**
   * Add (or update) a BirdWeather station and make it active.
   */
  connectBirdWeather: (
    token: string,
    bwStationId: string,
    stationName: string,
    timezone?: string,
    latitude?: number,
    longitude?: number,
  ) => Promise<void>;

  /** Add (or update) a BirdNET-Go station and make it active. */
  connectBirdNetGo: (hostUrl: string, stationName?: string) => Promise<void>;

  /** Add (or update) a BirdNET-Pi station and make it active. */
  connectBirdNetPi: (hostUrl: string, stationName?: string) => Promise<void>;

  /** Switch the active station. */
  switchStation: (id: string) => Promise<void>;

  /** Remove a station.  If it was active, the next station becomes active. */
  removeStation: (id: string) => Promise<void>;

  /**
   * Remove all stations and clear all persisted state.
   * Equivalent to a full logout / factory-reset.
   */
  disconnect: () => Promise<void>;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStationStore = create<StationState>((set, get) => ({
  stations: [],
  activeStationId: null,
  loading: false,
  isConnected: false,
  stationName: null,
  stationId: null,
  stationTimezone: null,
  hostUrl: null,
  connectionType: 'birdweather',

  // ── hydrate ────────────────────────────────────────────────────────────────

  hydrate: async () => {
    set({ loading: true });

    // 1. Check for legacy single-station data (v0.1–v0.3).
    //    If found, create a SavedStation from it and clear the old keys.
    const legacyConnectionType = await storage.getLegacyConnectionType();
    if (legacyConnectionType) {
      const legacyStationId = await storage.getLegacyStationId();
      const legacyTimezone = await storage.getLegacyTimezone();
      const legacyHostUrl = await storage.getLegacyHostUrl();
      const legacyToken = await storage.getToken();

      const id = storage.generateStationId();
      const type = legacyConnectionType as ConnectionType;

      const station: SavedStation = {
        id,
        connectionType: type,
        stationName:
          type === 'birdweather'
            ? `Station ${legacyStationId ?? ''}`
            : legacyHostUrl ?? 'Station',
        bwStationId: legacyStationId ?? undefined,
        stationTimezone: legacyTimezone ?? undefined,
        hostUrl: legacyHostUrl ?? undefined,
      };

      // Persist new format, erase old keys.
      await storage.setStationList([station]);
      await storage.setActiveStationId(id);
      if (legacyToken) await storage.setTokenForStation(id, legacyToken);
      await storage.clearAllLegacyKeys();

      set({
        stations: [station],
        activeStationId: id,
        loading: false,
        ...deriveActive([station], id),
      });
      return;
    }

    // 2. Normal multi-station load.
    const [stations, activeStationId] = await Promise.all([
      storage.getStationList(),
      storage.getActiveStationId(),
    ]);

    // If activeStationId points to a deleted station, fall back to the first.
    const validActiveId =
      stations.some((s) => s.id === activeStationId)
        ? activeStationId
        : stations[0]?.id ?? null;

    // Ensure the active station's token is current (needed after app restart).
    if (validActiveId) {
      const token = await storage.getTokenForStation(validActiveId);
      if (token) await storage.setToken(token);
    }

    set({
      stations,
      activeStationId: validActiveId,
      loading: false,
      ...deriveActive(stations, validActiveId),
    });
  },

  // ── connectBirdWeather ─────────────────────────────────────────────────────

  connectBirdWeather: async (token, bwStationId, stationName, timezone, latitude, longitude) => {
    const id = storage.generateStationId();
    const station: SavedStation = {
      id,
      connectionType: 'birdweather',
      stationName,
      bwStationId,
      stationTimezone: timezone,
      latitude,
      longitude,
    };

    const stations = [...get().stations, station];

    await Promise.all([
      storage.setStationList(stations),
      storage.setActiveStationId(id),
      storage.setToken(token),
      storage.setTokenForStation(id, token),
    ]);

    set({
      stations,
      activeStationId: id,
      ...deriveActive(stations, id),
    });
  },

  // ── connectBirdNetGo ───────────────────────────────────────────────────────

  connectBirdNetGo: async (hostUrl, stationName) => {
    const id = storage.generateStationId();
    const station: SavedStation = {
      id,
      connectionType: 'birdnetgo',
      stationName: stationName ?? hostUrl,
      hostUrl,
    };

    const stations = [...get().stations, station];

    await Promise.all([
      storage.setStationList(stations),
      storage.setActiveStationId(id),
    ]);

    set({
      stations,
      activeStationId: id,
      ...deriveActive(stations, id),
    });
  },

  // ── connectBirdNetPi ───────────────────────────────────────────────────────

  connectBirdNetPi: async (hostUrl, stationName) => {
    const id = storage.generateStationId();
    const station: SavedStation = {
      id,
      connectionType: 'birdnetpi',
      stationName: stationName ?? hostUrl,
      hostUrl,
    };

    const stations = [...get().stations, station];

    await Promise.all([
      storage.setStationList(stations),
      storage.setActiveStationId(id),
    ]);

    set({
      stations,
      activeStationId: id,
      ...deriveActive(stations, id),
    });
  },

  // ── switchStation ──────────────────────────────────────────────────────────

  switchStation: async (id) => {
    const { stations } = get();
    if (!stations.some((s) => s.id === id)) return;

    await storage.setActiveStationId(id);

    // Restore this station's BirdWeather token as the "active" token.
    const token = await storage.getTokenForStation(id);
    if (token) await storage.setToken(token);
    else await storage.clearToken();

    set({
      activeStationId: id,
      ...deriveActive(stations, id),
    });
  },

  // ── removeStation ──────────────────────────────────────────────────────────

  removeStation: async (id) => {
    const { stations, activeStationId } = get();
    const remaining = stations.filter((s) => s.id !== id);

    await storage.deleteTokenForStation(id);

    if (remaining.length === 0) {
      // Last station removed — full disconnect.
      await Promise.all([
        storage.setStationList([]),
        storage.clearActiveStationId(),
        storage.clearToken(),
      ]);
      set({
        stations: [],
        activeStationId: null,
        isConnected: false,
        stationName: null,
        stationId: null,
        stationTimezone: null,
        hostUrl: null,
        connectionType: 'birdweather',
      });
      return;
    }

    // If we removed the active station, switch to the first remaining one.
    const newActiveId = activeStationId === id ? (remaining[0]!.id) : activeStationId!;

    await storage.setStationList(remaining);
    await storage.setActiveStationId(newActiveId);

    if (activeStationId === id) {
      const token = await storage.getTokenForStation(newActiveId);
      if (token) await storage.setToken(token);
      else await storage.clearToken();
    }

    set({
      stations: remaining,
      activeStationId: newActiveId,
      ...deriveActive(remaining, newActiveId),
    });
  },

  // ── disconnect (full reset) ────────────────────────────────────────────────

  disconnect: async () => {
    const { stations } = get();

    await Promise.all([
      storage.setStationList([]),
      storage.clearActiveStationId(),
      storage.clearToken(),
      ...stations.map((s) => storage.deleteTokenForStation(s.id)),
    ]);

    set({
      stations: [],
      activeStationId: null,
      isConnected: false,
      stationName: null,
      stationId: null,
      stationTimezone: null,
      hostUrl: null,
      connectionType: 'birdweather',
    });
  },
}));
