import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

const PUSH_TOKEN_KEY = 'expo_push_token';

export async function requestPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function getExpoPushToken(): Promise<string | null> {
  try {
    const token = await Notifications.getExpoPushTokenAsync();
    await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token.data);
    return token.data;
  } catch {
    return null;
  }
}

export async function scheduleLocalNotification(title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
}
