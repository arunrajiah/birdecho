/**
 * In-app update checker for sideloaded (non-Play-Store) Android builds.
 *
 * BirdEcho is distributed as a signed APK attached to each GitHub Release under
 * the stable asset name `birdecho.apk`, so the URL below always resolves to the
 * newest build. On launch we compare the installed version against the latest
 * release tag and, if newer, offer an in-app download that hands the APK to
 * Android's package installer.
 *
 * Android requires the user to confirm the install (REQUEST_INSTALL_PACKAGES) —
 * there is no silent auto-update for sideloaded apps without device-owner/MDM
 * privileges. This is Android-only; on other platforms checkForUpdate() no-ops.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

const REPO = 'arunrajiah/birdecho';
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const APK_URL = `https://github.com/${REPO}/releases/latest/download/birdecho.apk`;
export const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;

// FLAG_GRANT_READ_URI_PERMISSION — lets the installer read our content:// URI.
const FLAG_GRANT_READ_URI_PERMISSION = 1;

export interface UpdateInfo {
  latestVersion: string;
  currentVersion: string;
  notes: string;
}

/**
 * Whether the in-app updater is active for this build. Disabled on non-Android
 * and on F-Droid/IzzyOnDroid builds (EXPO_PUBLIC_FDROID=1 at prebuild), which
 * ship their own update channel and disallow self-updating.
 */
export function isUpdaterEnabled(): boolean {
  if (Platform.OS !== 'android') return false;
  if (Constants.expoConfig?.extra?.fdroidBuild === true) return false;
  return true;
}

function parseVersion(v: string): number[] {
  return v
    .replace(/^v/i, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
}

/** True if `latest` is a strictly higher semver than `current`. */
export function isNewerVersion(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

/**
 * Returns update details if a newer release exists, else null.
 * Silently returns null on Android-only failure paths (offline, rate-limited,
 * non-Android) so the caller never has to surface a check error.
 */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!isUpdaterEnabled()) return null;
  const currentVersion = Application.nativeApplicationVersion ?? '0.0.0';

  let res: Response;
  try {
    res = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } });
  } catch {
    return null; // offline — stay quiet
  }
  if (!res.ok) return null;

  let data: { tag_name?: string; body?: string };
  try {
    data = (await res.json()) as { tag_name?: string; body?: string };
  } catch {
    return null;
  }

  const latestVersion = String(data.tag_name ?? '').replace(/^v/i, '');
  if (!latestVersion || !isNewerVersion(latestVersion, currentVersion)) return null;

  return { latestVersion, currentVersion, notes: String(data.body ?? '') };
}

/**
 * Download the latest APK and launch Android's package installer.
 * @param onProgress called with a 0–1 fraction as the download proceeds.
 * @throws if the download fails or the installer can't be launched.
 */
export async function downloadAndInstall(onProgress?: (fraction: number) => void): Promise<void> {
  const target = `${FileSystem.cacheDirectory}birdecho-update.apk`;

  // Remove any stale partial download so a retry starts clean.
  try {
    await FileSystem.deleteAsync(target, { idempotent: true });
  } catch {
    // best-effort
  }

  const downloader = FileSystem.createDownloadResumable(
    APK_URL,
    target,
    {},
    (p) => {
      if (p.totalBytesExpectedToWrite > 0) {
        onProgress?.(p.totalBytesWritten / p.totalBytesExpectedToWrite);
      }
    },
  );

  const result = await downloader.downloadAsync();
  if (!result?.uri) throw new Error('Download failed');

  // file:// URIs are rejected by the installer on Android 7+. Convert to a
  // content:// URI backed by expo-file-system's FileProvider.
  const contentUri = await FileSystem.getContentUriAsync(result.uri);

  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    flags: FLAG_GRANT_READ_URI_PERMISSION,
    type: 'application/vnd.android.package-archive',
  });
}
