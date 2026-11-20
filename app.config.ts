import type { ExpoConfig } from 'expo/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { withAndroidManifest, type ConfigPlugin } from 'expo/config-plugins';
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
 *   4. expo-location (GPS for a Base's location), left out of the F-Droid build
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

/**
 * Location is read once, while the app is open, to set where a Base stands (src/lib/phoneLocation.ts). Never in
 * the background. Only a position rounded to 2 decimals (about 1 km) is sent to the Base and shared.
 *
 * expo-location on Android needs Google Play services (play-services-location), which F-Droid does not accept,
 * so scripts/fdroid-prepare.mjs drops it from autolinking and this plugin is skipped there: the F-Droid build asks
 * for no location permission and falls back to the approximate area from Wildlife Network. The gate is that
 * autolinking exclude, not EXPO_PUBLIC_FDROID, because the Play Store profile also sets EXPO_PUBLIC_FDROID=1.
 */
const autolinkExclude: string[] =
  (JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8')) as { expo?: { autolinking?: { exclude?: string[] } } }).expo
    ?.autolinking?.exclude ?? [];
const hasLocationModule = !autolinkExclude.includes('expo-location');

const LOCATION_REASON =
  'BirdEcho uses your location to set where your Wildlife Network Base or bird station stands. Only a position rounded to about 1 km is sent to the Base and shared.';

/**
 * expo-location's library manifest declares a location foreground service for background tracking, which BirdEcho
 * never uses. Removing it keeps the merged manifest to the two foreground location permissions.
 */
const withoutLocationService: ConfigPlugin = (cfg) =>
  withAndroidManifest(cfg, (c) => {
    const manifest = c.modResults.manifest;
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    const app = manifest.application?.[0];
    if (app) {
      const name = 'expo.modules.location.services.LocationTaskService';
      app.service = [
        ...(app.service ?? []).filter((x) => x.$['android:name'] !== name),
        { $: { 'android:name': name, 'tools:node': 'remove' } } as unknown as NonNullable<typeof app.service>[number],
      ];
    }
    return c;
  });

const locationPlugins: NonNullable<ExpoConfig['plugins']> = !hasLocationModule
  ? []
  : [
      [
        'expo-location',
        {
          locationWhenInUsePermission: LOCATION_REASON,
          // false removes the key: BirdEcho never asks for background ("Always") location.
          locationAlwaysPermission: false,
          locationAlwaysAndWhenInUsePermission: false,
          isIosBackgroundLocationEnabled: false,
          isAndroidBackgroundLocationEnabled: false,
          isAndroidForegroundServiceEnabled: false,
        },
      ],
    ];

const config: ExpoConfig = {
  ...base,
  ios: {
    ...base.ios,
    // App Store build number mirrors the Android versionCode so one bump in
    // app.json covers both stores. An iOS-only rebuild of the same versionCode
    // can set ios.buildNumber to "<versionCode>.N"; it is ignored once versionCode moves on.
    buildNumber: base.ios?.buildNumber?.startsWith(`${base.android?.versionCode}.`)
      ? base.ios.buildNumber
      : String(base.android?.versionCode ?? 1),
  },
  android: {
    ...base.android,
    // Only emit the Google Maps key block when a key is actually provided —
    // never write an empty-string API_KEY (see note above).
    ...(hasGoogleMapsKey
      ? { config: { ...base.android?.config, googleMaps: { apiKey: googleMapsApiKey } } }
      : {}),
    // REQUEST_INSTALL_PACKAGES lets the in-app updater hand a downloaded APK to
    // Android's installer. Omitted entirely for F-Droid/IzzyOnDroid builds.
    // Location is never wanted in the background, even if a library asks for it.
    blockedPermissions: [
      ...(base.android?.blockedPermissions ?? []),
      'android.permission.ACCESS_BACKGROUND_LOCATION',
      'android.permission.FOREGROUND_SERVICE_LOCATION',
    ],
    permissions: [
      ...(base.android?.permissions ?? []),
      ...(isFdroidBuild ? [] : ['android.permission.REQUEST_INSTALL_PACKAGES']),
    ],
  },
  plugins: [
    ...(base.plugins ?? []),
    ...locationPlugins,
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

export default hasLocationModule ? withoutLocationService(config) : config;
