/**
 * Custom entry point.
 *
 * react-native-android-widget requires `registerWidgetTaskHandler` to be
 * called at startup so that Android can invoke the handler as a headless JS
 * task when the app is closed.  Expo Router normally owns the entry via the
 * "main": "expo-router/entry" shorthand; we replace that shorthand here and
 * import expo-router/entry manually after registering the handler.
 *
 * package.json  →  "main": "./index.js"
 */
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/widgetTaskHandler';

// Register before expo-router bootstraps the React app so the handler is
// available for headless task invocations from the moment the JS engine starts.
registerWidgetTaskHandler(widgetTaskHandler);

// Hand off to Expo Router for everything else.
import 'expo-router/entry';
