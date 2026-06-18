import type { ExpoConfig } from 'expo/config';
import appJson from './app.json';

/**
 * app.config.ts supersedes app.json — Expo reads THIS file, not app.json, when
 * it exists. To prevent the two from drifting (version/versionCode bumps in
 * app.json were previously silently ignored), this file now *reads* app.json as
 * its base and only layers on the bits that can't be expressed in plain JSON:
 *
 *   1. the react-native-android-widget config plugin (needs an object argument)
 *   2. the Google Maps API key (sourced from the environment at prebuild time)
 *   3. the REQUEST_INSTALL_PACKAGES permission (for the in-app GitHub updater)
 *
 * Edit version, versionCode, and everything else in app.json — it flows through
 * here automatically.
 */
const base = appJson.expo as ExpoConfig;

const config: ExpoConfig = {
  ...base,
  android: {
    ...base.android,
    // Google Maps tiles for the map tab. Blank tiles (no key) still allow
    // markers and interaction. Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY before prebuild.
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
      },
    },
    // Required so the in-app updater can hand a downloaded APK to Android's
    // package installer (sideloaded builds have no Play Store auto-update).
    permissions: [...(base.android?.permissions ?? []), 'android.permission.REQUEST_INSTALL_PACKAGES'],
  },
  plugins: [
    ...(base.plugins ?? []),
    [
      'react-native-android-widget',
      {
        widgets: [
          {
            // Expo prebuild generates `BirdStationWidgetProvider`; must match the
            // widgetName passed to requestWidgetUpdate.
            name: 'BirdStation',
            label: 'BirdEcho – Latest Detection',
            minWidth: '250dp',
            minHeight: '110dp',
            description: 'Shows the latest bird detection from your BirdEcho station.',
            resizeMode: 'horizontal|vertical',
            // configuration_optional → usable immediately after being added.
            widgetFeatures: 'reconfigurable|configuration_optional',
          },
        ],
      },
    ],
  ],
  extra: {
    ...base.extra,
    eas: {
      projectId: 'eabffb00-b763-416a-afc6-85897ebb0e92',
    },
  },
  owner: 'arunrajiah',
};

export default config;
