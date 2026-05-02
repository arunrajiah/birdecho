# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2] — 2026-05-02

### Fixed

- **BirdNET-Go `http://` connections blocked on Android** (issue #14 follow-up): Android 9+ (API 28) blocks plaintext HTTP traffic in production apps by default. BirdNET-Go stations are almost always served over plain HTTP on a local network, so the `fetch()` call was rejected at the OS level before even reaching the station. Fixed by setting `android:usesCleartextTraffic="true"` in the Android manifest via `app.json`. iOS is fixed by adding `NSAllowsLocalNetworking: true` to the App Transport Security config (allows HTTP for RFC 1918 private addresses only, without opening HTTPS-bypass for the internet).

---

## [0.2.1] — 2026-05-02

### Fixed

- **BirdNET-Go connection always failed** (issue #14): the connect screen reported "Unexpected response from BirdNET-Go station" even when the station was fully reachable on the local network. Root cause: the liveness probe (`/api/v2/ping`) was using a JSON-only fetch helper, but BirdNET-Go's ping endpoint returns plain text — causing the Content-Type check to reject an otherwise healthy response. The ping now uses a raw HTTP fetch (just needs HTTP 200). Error messages on connection failure are also more specific.
- GitHub Actions workflows updated to Node.js 24 and latest action versions ahead of GitHub's June 2026 enforcement deadline.

---

## [0.2.0] — 2026-05-01

### Added

**BirdNET-Go direct connection**
- Connect to a local BirdNET-Go instance over your home network — no BirdWeather account needed
- New connect screen with BirdWeather / BirdNET-Go mode toggle
- BirdNET-Go adapter covers: live detection feed, audio playback, species browser, stats, 14-day chart
- Host URL validated against `/api/v2/ping` before saving; station name auto-fetched from `/api/v2/settings/dashboard`
- Audio served from `/api/v2/media/audio/{clipName}`; species images from `/api/v2/media/image/{scientificName}`
- Offset→cursor pagination bridges BirdNET-Go's offset/limit API with BirdWeather's cursor model

**Connection error UX**
- Structured `ErrorState` component replaces blank screens on network and API errors
- Auth errors (401/403) show a "Reconnect station" prompt that navigates directly to the connect screen
- Network errors and API errors show a retry button with a subject-specific message (feed / species / stats)

**Station timezone localisation**
- Detection timestamps displayed in the station's IANA timezone (e.g. `America/New_York`), not UTC
- `formatTime()` and `formatDateTime()` helpers using `Intl.DateTimeFormat` with timezone fallback

### Changed

**Settings screen**
- Station info section now shows connection type and host URL / BirdWeather ID for BirdNET-Go connections
- Notification toggle label updated to "Coming soon — grant permission now to opt in early"; removes misleading push-token collection

### Fixed

- Favorites list migrated from `expo-secure-store` (2 KB per-key limit) to `@react-native-async-storage/async-storage` — large favourites lists no longer silently truncate
- `package-lock.json` removed from repository (project uses pnpm; npm lockfile was conflicting)

### Security

- BirdWeather API token moved from `?token=` URL query parameter to `X-Auth-Token` request header — prevents token appearing in server logs, referrer headers, and browser history
- Response body capped at 200 characters in error messages to prevent sensitive data leaking through error surfaces
- `Content-Type: application/json` validated before calling `.json()` on API responses
- GitHub Actions workflow actions pinned to exact commit SHAs (supply-chain hardening)
- Keystore file automatically deleted from CI runner disk immediately after signing
- Global `permissions: {}` deny-by-default added to all workflow files; jobs declare only what they need
- Sentry `beforeSend` hook strips `X-Auth-Token` header and `token` query parameter from captured events
- `SECURITY.md` extended with explicit response-timeline table (48 h ack → 7 d confirm → 14 d patch → 90 d disclosure)

---

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
