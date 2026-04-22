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

## 🔜 v0.2 — Near-term

- **F-Droid submission** — get BirdEcho listed on F-Droid for users who prefer not to sideload APKs
- **Screenshots in README and release notes** — real device captures to help new users know what they're installing
- **Connection error UX** — clearer messages when token is wrong, station is offline, or BirdWeather is unreachable
- **Sighting timestamp localisation** — show detection times in the device's local timezone rather than UTC

---

## 🗓 v0.3 — Medium-term

- **Direct BirdNET-Pi HTTP API support** — connect to a local BirdNET-Pi instance without needing BirdWeather integration
- **Direct BirdNET-Go HTTP API support** — same, for BirdNET-Go stations
- **Home screen widget** — today's detection count and last detected species, glanceable without opening the app
- **Offline cache** — persist the last N detections so the feed is readable without a network connection

---

## 🔭 v0.4 — Longer-term

- **iOS App Store / TestFlight** — a signed iOS build distributed through the App Store
- **Multi-station support** — monitor more than one station from the same app, switch with a swipe
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
