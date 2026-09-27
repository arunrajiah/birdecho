# F-Droid submission notes

`dev.arunrajiah.birdecho.yml` in this directory is the fdroiddata recipe. It was verified
locally against fdroidserver 2.4.5: `fdroid lint` is clean and the source scanner reports
0 problems after the `rm:` step (94 before the v0.9.1 changes). It has **not** yet been
through a full `fdroid build --on-server` (needs a Linux buildserver; F-Droid's CI runs it
on the merge request).

## What the F-Droid build changes

| Concern | Resolution |
|---|---|
| `react-native-maps` pulls Google Play Services | Excluded from autolinking by `scripts/fdroid-prepare.mjs`; the Map tab shows a station list instead. The native map is only loaded when `Constants.expoConfig.extra.hasGoogleMapsKey` is true, which never holds for F-Droid builds (the Play Store profile also sets `EXPO_PUBLIC_FDROID=1`, so `fdroidBuild` alone is not a usable gate). Native map code lives in `src/components/StationMap.tsx` and is `require()`d lazily. |
| `@sentry/react-native` ships prebuilt stub jars | Excluded from autolinking. The JS import is harmless without the native module and `Sentry.init` never runs without a DSN. |
| `expo-notifications` depends on Firebase Cloud Messaging | Removed by `patches/expo-notifications@0.32.16.patch` (applies to every build; BirdEcho only uses local notifications). |
| `expo-application` depends on the Play Install Referrer client | Removed by `patches/expo-application@7.0.8.patch`. It is now only a transitive dep of expo-notifications. |
| Expo SDK 54 ships prebuilt AARs (`expo-*/local-maven-repo`) | `fdroid-prepare.mjs` sets `expo.autolinking.android.buildFromSource: ['.*']`; the recipe `rm:`s the AARs. |
| In-app updater + `REQUEST_INSTALL_PACKAGES` | `EXPO_PUBLIC_FDROID=1` at prebuild time drops both (see `app.config.ts`). |
| Hermes compiler binary (`sdks/hermesc/linux64-bin`) | `scanignore`. It is a host build tool from the react-native npm package and does not ship in the APK. If reviewers object, the fallback is building hermesc from source. |

pnpm stores packages under `node_modules/.pnpm/<name>@<ver>_<hash>/` and symlinks them into
`node_modules/`; the scanner walks the real paths, so `rm:`/`scanignore:` use `.pnpm/...@*` globs.
fdroidserver fails if a glob matches nothing, so every entry must exist on a fresh Linux install.

Reproducible builds are not attempted (Expo + Hermes output is not deterministic), so F-Droid
signs with its own key. Users who installed the GitHub APK must reinstall to switch.

## Recipe drift after v0.9.2

The recipe in this directory is ahead of the one in the fdroiddata merge request. It adds two
`rm:` entries (`wear`, `modules/wear-sync/android`) for the Wear OS work, which uses Google Play
Services. Those paths do not exist at v0.9.2, and fdroidserver fails on an `rm:` path that matches
nothing, so the MR must keep the v0.9.2 recipe. Add the two entries to fdroiddata when the first
release containing `wear/` is tagged; without them the F-Droid scanner will reject that release.

## Opening the merge request

1. Fork https://gitlab.com/fdroid/fdroiddata and clone it (`--depth 1` is fine).
2. Copy `docs/fdroid/dev.arunrajiah.birdecho.yml` to `metadata/dev.arunrajiah.birdecho.yml`.
3. Commit as `New app: BirdEcho` on a branch, push, open the MR against `master`.
4. F-Droid CI runs lint and a full build; a reviewer then goes through the recipe. Expect
   questions about the hermesc `scanignore` and the two pnpm patches (point them here).

## Per-release maintenance

`AutoUpdateMode: Version` + `UpdateCheckMode: Tags` means the F-Droid bot adds a build block
for each new `v*` tag by copying the last one. The recipe only needs a manual touch when:

- the Node 24 LTS patch version should be bumped (URL and SHA-256 together, from
  https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt),
- a dependency upgrade changes the pnpm patch targets (`pnpm patch <pkg>@<ver>` again),
- a new dependency brings binaries or proprietary libs. Re-run the scanner check below.

### Re-running the scanner locally

```
python3 -m venv /tmp/fd && /tmp/fd/bin/pip install fdroidserver
mkdir -p /tmp/fdroiddata/metadata && cp docs/fdroid/dev.arunrajiah.birdecho.yml /tmp/fdroiddata/metadata/
rm -rf node_modules && pnpm install --frozen-lockfile && node scripts/fdroid-prepare.mjs
EXPO_PUBLIC_FDROID=1 CI=1 npx expo prebuild --platform android --clean --no-install
```

Then, from `/tmp/fdroiddata`, apply the recipe's `rm:` globs and call
`fdroidserver.scanner.scan_source(<repo>, build)` (see git history of this file for the
harness). Finish with `git checkout package.json`.

## IzzyOnDroid (optional, faster)

IzzyOnDroid takes the signed APK straight from GitHub Releases: open an issue at
https://gitlab.com/IzzyOnDroid/repo/-/issues titled `Request: BirdEcho` with the releases URL,
package name `dev.arunrajiah.birdecho` and license MIT. Independent of the fdroiddata MR.
