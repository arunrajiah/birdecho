#!/usr/bin/env node
/**
 * F-Droid build preparation. Run after `pnpm install` and before `expo prebuild`.
 *
 * F-Droid builds everything from source and rejects proprietary dependencies, so
 * this script rewrites package.json's Expo autolinking config to:
 *   - exclude react-native-maps (pulls in Google Play Services) and
 *     @sentry/react-native (ships prebuilt stub jars); the JS side handles both
 *     being absent when Constants.expoConfig.extra.fdroidBuild is true, and
 *   - compile every expo-* module from source instead of using the prebuilt
 *     AARs that Expo SDK 54 ships in node_modules/expo-*\/local-maven-repo.
 *
 * Only the F-Droid recipe runs this; EAS and GitHub Release builds are untouched.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../package.json', import.meta.url);
const pkg = JSON.parse(readFileSync(path, 'utf8'));

pkg.expo = {
  ...(pkg.expo ?? {}),
  autolinking: {
    ...(pkg.expo?.autolinking ?? {}),
    exclude: ['react-native-maps', '@sentry/react-native'],
    android: { ...(pkg.expo?.autolinking?.android ?? {}), buildFromSource: ['.*'] },
  },
};

writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
console.log('package.json: F-Droid autolinking config applied');
