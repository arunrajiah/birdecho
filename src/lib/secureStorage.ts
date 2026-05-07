/**
 * Thin wrappers around expo-secure-store and AsyncStorage.
 *
 * Key layout
 * ──────────
 * SecureStore (device Keychain / Keystore):
 *   birdweather_token              — active station's BirdWeather API token
 *                                    (read by apiClient.ts on every request)
 *   birdweather_token_{stationId}  — per-station token archive (for switching)
 *   birdecho_active_station        — app-internal ID of the active station
 *
 * AsyncStorage (unencrypted, non-sensitive):
 *   birdecho-stations              — JSON-serialised SavedStation[] list
 *
 * Legacy single-station keys (v0.1–v0.3, migrated on first hydrate):
 *   birdweather_token              — unchanged, reused as "active token"
 *   birdweather_station_id         — BirdWeather station ID
 *   birdweather_timezone           — timezone string
 *   connection_type                — 'birdweather' | 'birdnetgo' | 'birdnetpi'
 *   birdnetgo_host_url             — host URL
 */
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SavedStation } from '../types/station';

// ─── Active BirdWeather token (read by apiClient per-request) ────────────────

const TOKEN_KEY = 'birdweather_token';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ─── Per-station token archive ────────────────────────────────────────────────

function stationTokenKey(stationId: string): string {
  return `birdweather_token_${stationId}`;
}

export async function getTokenForStation(stationId: string): Promise<string | null> {
  return SecureStore.getItemAsync(stationTokenKey(stationId));
}

export async function setTokenForStation(stationId: string, token: string): Promise<void> {
  await SecureStore.setItemAsync(stationTokenKey(stationId), token);
}

export async function deleteTokenForStation(stationId: string): Promise<void> {
  await SecureStore.deleteItemAsync(stationTokenKey(stationId));
}

// ─── Active station ID ────────────────────────────────────────────────────────

const ACTIVE_STATION_KEY = 'birdecho_active_station';

export async function getActiveStationId(): Promise<string | null> {
  return SecureStore.getItemAsync(ACTIVE_STATION_KEY);
}

export async function setActiveStationId(id: string): Promise<void> {
  await SecureStore.setItemAsync(ACTIVE_STATION_KEY, id);
}

export async function clearActiveStationId(): Promise<void> {
  await SecureStore.deleteItemAsync(ACTIVE_STATION_KEY);
}

// ─── Station list ─────────────────────────────────────────────────────────────

const STATION_LIST_KEY = 'birdecho-stations';

export async function getStationList(): Promise<SavedStation[]> {
  try {
    const raw = await AsyncStorage.getItem(STATION_LIST_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedStation[];
  } catch {
    return [];
  }
}

export async function setStationList(stations: SavedStation[]): Promise<void> {
  await AsyncStorage.setItem(STATION_LIST_KEY, JSON.stringify(stations));
}

// ─── Opaque ID generator ──────────────────────────────────────────────────────

export function generateStationId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── Legacy single-station keys (v0.1–v0.3) ──────────────────────────────────
// These are kept to support the migration that runs on first hydrate.
// They are NOT written anywhere after migration.

const STATION_ID_KEY = 'birdweather_station_id';
const TIMEZONE_KEY = 'birdweather_timezone';
const CONNECTION_TYPE_KEY = 'connection_type';
const HOST_URL_KEY = 'birdnetgo_host_url';

export async function getLegacyStationId(): Promise<string | null> {
  return SecureStore.getItemAsync(STATION_ID_KEY);
}

export async function getLegacyTimezone(): Promise<string | null> {
  return SecureStore.getItemAsync(TIMEZONE_KEY);
}

export async function getLegacyConnectionType(): Promise<string | null> {
  return SecureStore.getItemAsync(CONNECTION_TYPE_KEY);
}

export async function getLegacyHostUrl(): Promise<string | null> {
  return SecureStore.getItemAsync(HOST_URL_KEY);
}

export async function clearAllLegacyKeys(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(STATION_ID_KEY),
    SecureStore.deleteItemAsync(TIMEZONE_KEY),
    SecureStore.deleteItemAsync(CONNECTION_TYPE_KEY),
    SecureStore.deleteItemAsync(HOST_URL_KEY),
    // NOTE: TOKEN_KEY (birdweather_token) is intentionally kept — it becomes
    // the active-station token under the new scheme too.
  ]);
}

// ─── Legacy aliases (kept so existing callers outside the store still compile) ─
// These are used only by tests / one-off migration code; no new code should
// call them.

/** @deprecated use setToken + setTokenForStation */
export async function setStationId(id: string): Promise<void> {
  await SecureStore.setItemAsync(STATION_ID_KEY, id);
}
/** @deprecated */
export async function setTimezone(timezone: string): Promise<void> {
  await SecureStore.setItemAsync(TIMEZONE_KEY, timezone);
}
/** @deprecated */
export async function setConnectionType(type: string): Promise<void> {
  await SecureStore.setItemAsync(CONNECTION_TYPE_KEY, type);
}
/** @deprecated */
export async function setHostUrl(url: string): Promise<void> {
  await SecureStore.setItemAsync(HOST_URL_KEY, url);
}
