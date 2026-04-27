import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'birdweather_token';
const STATION_ID_KEY = 'birdweather_station_id';
const TIMEZONE_KEY = 'birdweather_timezone';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getStationId(): Promise<string | null> {
  return SecureStore.getItemAsync(STATION_ID_KEY);
}

export async function setStationId(id: string): Promise<void> {
  await SecureStore.setItemAsync(STATION_ID_KEY, id);
}

export async function clearStationId(): Promise<void> {
  await SecureStore.deleteItemAsync(STATION_ID_KEY);
}

export async function getTimezone(): Promise<string | null> {
  return SecureStore.getItemAsync(TIMEZONE_KEY);
}

export async function setTimezone(timezone: string): Promise<void> {
  await SecureStore.setItemAsync(TIMEZONE_KEY, timezone);
}

export async function clearTimezone(): Promise<void> {
  await SecureStore.deleteItemAsync(TIMEZONE_KEY);
}
