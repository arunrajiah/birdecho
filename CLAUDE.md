# BirdEcho
Mobile companion app for backyard bird stations (BirdNET-Pi): "Your backyard bird station, on your phone."

## Stack
Expo (React Native) + TypeScript, expo-router, NativeWind/Tailwind, TanStack Query (+ async-storage persistence), Sentry, pnpm, EAS builds.

## Layout
- `app/` - expo-router routes: `(tabs)`, `connect`, `record`, `species`
- `src/` - api, components, hooks, lib, stores, theme, types, widgets (Android widget via react-native-android-widget)
- `wear/` - standalone native Kotlin Wear OS app (tile + app); built only in CI (`wear.yml`), no Gradle wrapper committed
- `modules/wear-sync/` - Expo local module, sends active station to the watch (Play Services; excluded from F-Droid)
- `patches/` - pnpm patches stripping Firebase / Install Referrer; `scripts/fdroid-prepare.mjs` - F-Droid autolinking config
- `assets/`, `docs/`, `fastlane/` - media, docs, store automation
- Config: `app.config.ts`, `eas.json`, `tailwind.config.js`, `metro.config.js`

## Commands
- `pnpm start` - expo dev server; `pnpm ios` / `pnpm android` - run on device
- `pnpm lint` - expo lint; `pnpm typecheck` - tsc --noEmit; `pnpm test` - adapter tests (node:test) replaying real station responses in `tests/fixtures/`
- `pnpm build:android|build:ios|build:all` - EAS production builds (side effect: cloud builds, store credentials)

## Conventions
- Tailwind classes via NativeWind; routes are file-based under `app/`.
- No em dashes in user-facing copy.
- Station adapters (`src/api/adapters/`, `src/api/*.ts`): verify API claims against the station's source or a live server, never from memory; add a fixture test for each fix. BirdNET-Pi HTML differs by fork (Nachtzuster vs mcguirepr89).
- Release: bump `app.json` version + versionCode, CHANGELOG entry, fastlane changelog `<versionCode>.txt`, then push tag `vX.Y.Z` (GitHub Actions builds the APK).

## Token efficiency
- Grep/Glob to the target file; read only the relevant section, never whole large files.
- Don't re-read files after editing. Verify once per batch of edits, not per edit.
- Keep progress narration and final summaries to 2-3 sentences.
