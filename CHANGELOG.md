# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-04-20

### Added

**Core infrastructure**
- Expo SDK 54 (managed workflow, new architecture enabled) with Expo Router v6, TypeScript strict mode, NativeWind v4
- TanStack Query v5 for all remote data — infinite queries, parallel queries, 60-second background polling
- Zustand v5 stores for station, favorites, and theme state; all persisted via `expo-secure-store` (device Keychain / Keystore)
- Brand colour palette: warm gold `#C8A94C`, forest green `#1A3226`, cream `#F5F0E8`, stone `#78716C`, sunset orange `#E26A2C`
- Optional Sentry error tracking (`@sentry/react-native`) gated on `EXPO_PUBLIC_SENTRY_DSN` env var

**Station connection**
- Connect screen: API token + Station ID inputs, validated live against the BirdWeather API
- Station name fetched on connect and displayed throughout the app
- Token stored in the device secure enclave; never logged or transmitted elsewhere

**Feed tab**
- Infinite-scroll detection feed backed by `useInfiniteQuery` with cursor pagination
- Pull-to-refresh and auto-refresh every 60 seconds via `refetchInterval`
- `@shopify/flash-list` for performant list rendering
- Confidence colour pill (green ≥ 80%, amber ≥ 50%, red < 50%)

**Sighting detail**
- Full-width species image, scientific name, confidence pill, timestamp, station name
- Audio playback with play/pause toggle via `expo-av`; sound unloaded on screen unmount
- Share sighting as a PNG card via `react-native-view-shot` + `expo-sharing`

**Species tab**
- Browse all species ever detected by the station (up to 200)
- Species detail screen: image, detection count, star/unstar, recent sightings list

**Stats tab**
- Headline totals: detections today, detections this week, unique species all-time
- 14-day detection bar chart via `victory-native`
- Top 10 species by detection count

**Favorites tab**
- Star any species from the species detail screen
- Favorites screen shows parallel-fetched species cards via `useQueries`
- Local notification on first daily detection of any favourited species (24-hour debounce)

**Settings tab**
- Light / Dark / System theme toggle, applied via NativeWind `setColorScheme`, persisted to SecureStore
- Notification opt-in: requests permission and registers Expo push token
- Disconnect and re-connect to a different station

**Repo & CI**
- GitHub Actions CI pipeline: `pnpm install --frozen-lockfile`, ESLint, TypeScript typecheck on every push/PR to `main`
- EAS build profiles: `development` (internal/simulator), `preview` (internal APK + simulator), `production` (store)
- MIT license, CONTRIBUTING guide, SECURITY policy, GitHub issue templates (bug, feature, support), PR template
- `.github/FUNDING.yml` for GitHub Sponsors (`arunrajiah`)
