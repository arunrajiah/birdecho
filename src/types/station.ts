/**
 * Core station types shared across the store, storage, and API layers.
 * Keep this file free of React / Zustand imports so it can be used anywhere.
 */

export type ConnectionType = 'birdweather' | 'birdnetgo' | 'birdnetpi';

/**
 * A single saved station entry.  The app can hold many of these; one is
 * active at a time.  The `id` field is an app-internal opaque string — it is
 * NOT the BirdWeather station ID (that lives in `bwStationId`).
 */
export interface SavedStation {
  /** App-internal identifier.  Used as the Zustand + React Query cache key. */
  id: string;
  connectionType: ConnectionType;
  /** Human-readable station display name. */
  stationName: string;
  /** BirdWeather numeric station ID (e.g. "12345").  BirdWeather only. */
  bwStationId?: string;
  /** IANA timezone string (e.g. "America/New_York").  BirdWeather only. */
  stationTimezone?: string;
  /** Base URL of the local BirdNET-Go or BirdNET-Pi instance. */
  hostUrl?: string;
  /** GPS latitude — populated for BirdWeather stations from the station API. */
  latitude?: number;
  /** GPS longitude — populated for BirdWeather stations from the station API. */
  longitude?: number;
}
