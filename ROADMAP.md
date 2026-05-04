# BirdEcho Roadmap

This is a living document. Items move between releases as priorities shift — check [Issues](https://github.com/arunrajiah/birdecho/issues) and [Discussions](https://github.com/arunrajiah/birdecho/discussions) for the latest status on any item.

Want to help ship something? Read [CONTRIBUTING.md](CONTRIBUTING.md) and pick up an issue tagged [`help wanted`](https://github.com/arunrajiah/birdecho/labels/help%20wanted).

---

## ✅ v0.1.0 — Shipped

- Live detection feed with 60-second polling, infinite scroll, pull-to-refresh
- Per-sighting detail: audio playback, share as image card
- Species browser with detection history
- 14-day detection bar chart, headline stats
- Favorites with daily local notifications
- Light / Dark / System theme
- Secure token storage (iOS Keychain / Android Keystore)
- GitHub Actions CI, signed release APK via Gradle

---

## ✅ v0.2.0 — Shipped

- **Connection error UX** — structured error states with auth-recovery flow; tapping "Reconnect station" returns to the connect screen instead of showing a blank feed
- **Station timezone localisation** — detection times displayed in the station's IANA timezone (e.g. `America/New_York`) rather than UTC
- **Direct BirdNET-Go HTTP API** — connect to a local BirdNET-Go instance over your home network; no BirdWeather account required. Covers feed, species, stats, audio, and species-image endpoints via `/api/v2`
- **Security hardening** — BirdWeather API token moved to `X-Auth-Token` header (never in the URL), GitHub Actions SHA-pinned, Sentry strips credentials before sending, Content-Type validated before JSON parsing, keystore auto-deleted after CI builds
- **Storage fix** — favorites migrated from `expo-secure-store` (2 KB limit) to `AsyncStorage` to support large favourites lists
- **Notifications UX** — settings toggle now honestly reflects the current state (OS permission grant + local confirmation); removes misleading Expo push-token collection that implied server-side push was already working

---

## 🔜 v0.3 — In progress

- **F-Droid submission** — get BirdEcho listed on F-Droid for users who prefer not to sideload APKs
- **Screenshots in README and release notes** — real device captures to help new users know what they're installing
- **Direct BirdNET-Pi HTTP API support** — connect to a local BirdNET-Pi instance without needing BirdWeather integration
- **Home screen widget** — today's detection count and last detected species, glanceable without opening the app
- ✅ **Offline cache** (v0.3.0) — last 24 hours of detections/species/stats persisted to AsyncStorage; feed is readable with no network connection

---

## 🔭 v0.4 — Longer-term

- **iOS App Store / TestFlight** — a signed iOS build distributed through the App Store
- **Multi-station support** — monitor more than one station from the same app, switch with a swipe
- **Rare-species push alerts** — server-side push notifications when a starred or regionally unusual species is detected
- **Map view** — show your station on a map alongside nearby public BirdWeather stations
- **Apple Watch / Wear OS glance** — last detection and daily count on your wrist

---

## 💡 Ideas (not yet scheduled)

These are things worth exploring but with no committed timeline:

- Spectrogram view on the sighting detail screen
- Species rarity badge (flag species that are unusual for your region or time of year)
- Export detections as CSV
- BirdWeather social features — reactions, comments on detections
- iPad / tablet layout optimisation
- Accessibility audit (VoiceOver / TalkBack)

---

## Out of scope

BirdEcho will **not** become a bird-identification app. It does not and will not record audio or run any neural-network model on-device. Its job is to surface what your existing station has already detected.
