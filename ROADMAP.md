# BirdEcho Roadmap

This is a living document. Items move between releases as priorities shift — check [Issues](https://github.com/arunrajiah/birdecho/issues) and [Discussions](https://github.com/arunrajiah/birdecho/discussions) for the latest status on any item.

> **Focus: Android.** Development is Android-first for now. iOS distribution (App Store / TestFlight) is **on hold** until the Android app matures — the codebase stays cross-platform (Expo / React Native), so iOS builds remain possible for contributors, but they are not a near-term priority.

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
- ✅ **Direct BirdNET-Pi HTTP API support** (v0.3.1) — connect to a local BirdNET-Pi instance over your LAN; supports both mcguirepr89 and Nachtzuster forks
- ✅ **Home screen widget** (v0.3.3) — today's detection count and last detected species, glanceable without opening the app
- ✅ **Offline cache** (v0.3.0) — last 24 hours of detections/species/stats persisted to AsyncStorage; feed is readable with no network connection

---

## ✅ v0.4.0 — Shipped

- ✅ **Multi-station support** — monitor any number of stations (BirdWeather, BirdNET-Go, BirdNET-Pi) from one app; switch with a tap from Settings

---

## ✅ v0.5.0 — Shipped

- ✅ **Station map tab** — all BirdWeather stations shown as interactive markers; tap to switch or open in native Maps app
- ✅ **Detection CSV export** — export the current feed as a `.csv` file from the Stats tab

---

## 🔭 v0.6 / v0.7 — In progress

- ✅ **Species rarity badge** (v0.6.0, reworked in v0.9.0) — a "Rare" badge in the Species/Favorites tabs and species detail. Now **user-defined**: mark species as rare from their detail page (the original auto-by-count heuristic mislabelled common-but-infrequent birds, #24). Regional/seasonal auto-rarity would need an external checklist dataset and remains out of scope.
- ✅ **Rare-species detection alerts** (v0.7.0) — opt-in local notification the first time each species you've marked as rare is detected per day. On-device only; server-side push for starred species may follow later.
- **Wear OS glance** — last detection and daily count on your wrist (Android)
- ⏸️ **iOS App Store / TestFlight** — _on hold_ (Android-first; see note at top)
- ⏸️ **Apple Watch glance** — _on hold_ (paired with the iOS pause)

---

## 💡 Ideas (not yet scheduled)

These are things worth exploring but with no committed timeline:

- Spectrogram view on the sighting detail screen
- Export detections as CSV
- BirdWeather social features — reactions, comments on detections
- iPad / tablet layout optimisation
- Accessibility audit (VoiceOver / TalkBack)

---

## Out of scope

BirdEcho will **not** become a bird-identification app. It does not and will not record audio or run any neural-network model on-device. Its job is to surface what your existing station has already detected.
