/**
 * Last-resort handler for fatal JS errors in release builds.
 *
 * React Native turns an uncaught JS error in a release build into a native
 * abort (the app just closes), which hides the cause. This is imported first
 * from index.js so it is installed before any other module runs: a fatal error
 * shows its message on screen instead of crashing, so it can be reported.
 */
import { AppRegistry, Alert, ScrollView, Text, View } from 'react-native';
import { createElement as h } from 'react';

let fatalMessage = null;

function FatalErrorScreen() {
  return h(
    View,
    { style: { flex: 1, backgroundColor: '#fff', paddingTop: 80, paddingHorizontal: 20 } },
    h(Text, { style: { fontSize: 20, fontWeight: '700', marginBottom: 12 } }, 'BirdEcho could not start'),
    h(Text, { style: { fontSize: 14, color: '#444', marginBottom: 12 } }, 'Please send this message to arunrajiah@gmail.com.'),
    h(ScrollView, null, h(Text, { selectable: true, style: { fontSize: 12, fontFamily: 'Menlo' } }, fatalMessage ?? 'Unknown error')),
  );
}

const g = globalThis;
if (!__DEV__ && g.ErrorUtils) {
  const previous = g.ErrorUtils.getGlobalHandler();
  g.ErrorUtils.setGlobalHandler((error, isFatal) => {
    if (!isFatal) return previous?.(error, isFatal);
    // Keep every fatal error in order: the first one is usually the real cause.
    const entry = `${error?.name ?? 'Error'}: ${error?.message ?? String(error)}\n${(error?.stack ?? '').slice(0, 600)}`;
    fatalMessage = `${fatalMessage ? `${fatalMessage}\n\n---\n\n` : ''}${entry}`.slice(0, 4000);
    // If the app never registered (error during startup), this screen is what runs.
    try {
      AppRegistry.registerComponent('main', () => FatalErrorScreen);
    } catch {}
    // If the app was already running, surface the message over it.
    try {
      Alert.alert('BirdEcho error', fatalMessage.slice(0, 1500));
    } catch {}
  });
}
