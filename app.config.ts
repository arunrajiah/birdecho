import type { ExpoConfig } from 'expo/config';

/**
 * app.config.ts supersedes app.json.
 * app.json is kept as a reference copy but is NOT read by Expo when this file exists.
 *
 * This file exists solely to add the react-native-android-widget Expo config plugin,
 * which cannot be expressed as a plain JSON plugin entry (it requires an object argument
 * with a `widgets` array).  All other config is mirrored verbatim from app.json so that
 * a single source of truth is easy to maintain.
 */
const config: ExpoConfig = {
  name: 'BirdEcho',
  slug: 'birdecho',
  version: '0.5.0',
  scheme: 'birdecho',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  android: {
    package: 'dev.arunrajiah.birdecho',
    versionCode: 13,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    /**
     * Google Maps API key for the react-native-maps map tab.
     * Without this key, Android map tiles are blank but station markers
     * still render and interactions still work.
     * Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in your environment before `expo prebuild`.
     */
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
      },
    },
  },
  ios: {
    bundleIdentifier: 'dev.arunrajiah.birdecho',
    supportsTablet: true,
    infoPlist: {
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: false,
        NSAllowsLocalNetworking: true,
      },
    },
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-build-properties',
      {
        android: {
          usesCleartextTraffic: true,
        },
      },
    ],
    [
      'react-native-android-widget',
      {
        widgets: [
          {
            /**
             * Widget class name prefix.  Expo prebuild generates
             * `BirdStationWidgetProvider` in the Android manifest.
             * This must match the `widgetName` passed to `requestWidgetUpdate`.
             */
            name: 'BirdStation',
            label: 'BirdEcho – Latest Detection',
            minWidth: '250dp',
            minHeight: '110dp',
            description: 'Shows the latest bird detection from your BirdEcho station.',
            /** Use the launcher icon as the preview until a dedicated preview is designed. */
            previewImage: '@mipmap/ic_launcher',
            resizeMode: 'horizontal|vertical',
            /**
             * `configuration_optional` means no configuration activity is required —
             * the widget is usable immediately after being added to the home screen.
             */
            widgetFeatures: 'reconfigurable|configuration_optional',
          },
        ],
      },
    ],
  ],
  extra: {
    router: {},
    eas: {
      projectId: 'eabffb00-b763-416a-afc6-85897ebb0e92',
    },
  },
  owner: 'arunrajiah',
};

export default config;
