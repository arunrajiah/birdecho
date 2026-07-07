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

/**
 * F-Droid / IzzyOnDroid build flag. Set EXPO_PUBLIC_FDROID=1 before `expo prebuild`
 * to produce a repo-compliant build: the in-app GitHub APK updater is disabled and
 * the REQUEST_INSTALL_PACKAGES permission is dropped (those repos ship their own
 * updates, and their inclusion policy disallows self-updating without an explicit
 * bypass opt-in). The default GitHub build keeps the updater.
 */
const isFdroidBuild = process.env.EXPO_PUBLIC_FDROID === '1';

/**
 * Google Maps API key for Android map tiles, sourced from the environment at
 * prebuild time. Only baked into the manifest when actually present: an
 * *empty-value* `com.google.android.geo.API_KEY` meta-data tag crashes the
 * native Google Maps SDK on init (grey screen → crash — issue #25), which is
 * worse than omitting the tag. Keyless builds (incl. F-Droid) instead render a
 * fallback on the Map tab via the `hasGoogleMapsKey` flag below.
 */
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
const hasGoogleMapsKey = googleMapsApiKey.length > 0;

const config: ExpoConfig = {
  ...base,
  android: {
    ...base.android,
    // Only emit the Google Maps key block when a key is actually provided —
    // never write an empty-string API_KEY (see note above).
    ...(hasGoogleMapsKey
      ? { config: { ...base.android?.config, googleMaps: { apiKey: googleMapsApiKey } } }
      : {}),
    // REQUEST_INSTALL_PACKAGES lets the in-app updater hand a downloaded APK to
    // Android's installer. Omitted entirely for F-Droid/IzzyOnDroid builds.
    permissions: [
      ...(base.android?.permissions ?? []),
      ...(isFdroidBuild ? [] : ['android.permission.REQUEST_INSTALL_PACKAGES']),
    ],
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
    // eas.projectId is inherited from app.json (extra.eas.projectId), written by
    // `eas init`. Don't hardcode it here — that would override app.json and pin
    // the build to the wrong EAS project.
    // Baked into the build so the JS layer can disable the updater UI to match
    // the dropped permission above. Read via Constants.expoConfig.extra.
    fdroidBuild: isFdroidBuild,
    // Whether a Google Maps API key was baked in at prebuild. The Map tab reads
    // this to avoid mounting the native Google MapView on Android without a key
    // (which crashes — issue #25).
    hasGoogleMapsKey,
  },
  owner: 'arunrajiah',
};

export default config;
