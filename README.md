<div align="center">

# BirdEcho

**Your backyard bird station, on your phone.**

[![CI](https://github.com/arunrajiah/birdecho/actions/workflows/ci.yml/badge.svg)](https://github.com/arunrajiah/birdecho/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/arunrajiah/birdecho)](https://github.com/arunrajiah/birdecho/releases)
[![Sponsors ❤️](https://img.shields.io/badge/Sponsors-%E2%9D%A4%EF%B8%8F-ea4aaa)](https://github.com/sponsors/arunrajiah)

</div>

---

## What is BirdEcho?

BirdEcho is a free, open-source Android companion app for existing **BirdNET-Pi**, **BirdNET-Go**, and **BirdWeather** audio detection stations. If you already have a station running, BirdEcho lets you follow it from your phone — no new hardware, no cloud account required.

BirdEcho is **not** a bird-identification app. It does not listen to audio or identify birds itself. It surfaces what your station has already detected, puts the data in your pocket, and notifies you when a species you care about shows up.

---

## Screenshots

> Screenshots coming soon — if you're running BirdEcho against your station, we'd love your help! See [docs/media/README.md](docs/media/README.md) for the capture checklist and how to submit a PR.

---

## Features

### Feeds & Detections
- **Live detection feed** — auto-refreshed every 60 seconds, infinite scroll, pull-to-refresh
- **Offline cache** — last 24 hours of detections persisted locally; feed is readable with no network, stale data shown instantly while a background refresh runs
- **Sighting detail** — tap any detection to play the audio recording and share a PNG card
- **Detection times** shown in your station's local timezone

### Species
- **Species browser** — every species your station has ever detected, with images
- **Species detail** — detection count, recent sightings list, star/unstar

### Stats & Export
- **Headline stats** — detections today, this week, unique species all-time
- **14-day detection bar chart**
- **Top 10 species** by detection count
- **CSV export** — export the current feed as a `.csv` file from the Stats tab

### Stations
- **Multi-station support** — monitor any number of BirdWeather, BirdNET-Go, and BirdNET-Pi stations from one app; switch with a tap from Settings
- **Station map** — all your BirdWeather stations on an interactive map; tap a marker to switch stations or open in Apple/Google Maps
- **Direct BirdNET-Go support** — connect over your home network; no BirdWeather account needed
- **Direct BirdNET-Pi support** — connect to a local BirdNET-Pi instance (both mcguirepr89 and Nachtzuster forks supported)

### Notifications & Widget
- **Favourites** — star any species and get a local notification the first time it's detected each day
- **Android home-screen widget** — today's detection count and last detected species, glanceable without opening the app

### Customisation
- Light / Dark / System theme
- Secure token storage via iOS Keychain / Android Keystore

---

## Download

**Android** — grab the latest signed APK directly from [GitHub Releases](https://github.com/arunrajiah/birdecho/releases/latest).

> No Play Store account needed — enable "Install from unknown sources" in Android Settings, download the APK, and install.

**iOS** — community builds are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to build locally with EAS. iOS App Store / TestFlight is planned for a future release.

> F-Droid submission is in progress.

---

## Connecting your station

### BirdNET-Pi (direct, no cloud required)

1. Make sure your BirdNET-Pi is reachable from your phone — same Wi-Fi network or VPN.
2. Open BirdEcho → **Connect your station** → choose **BirdNET-Pi**.
3. Enter the host URL, e.g. `http://birdnetpi.local` or `http://192.168.1.50`. BirdEcho will probe the station before saving.

Both the original [mcguirepr89/BirdNET-Pi](https://github.com/mcguirepr89/BirdNET-Pi) and the [Nachtzuster fork](https://github.com/Nachtzuster/BirdNET-Pi) are supported.

### BirdNET-Go (direct, no cloud required)

1. Make sure your BirdNET-Go instance is reachable from your phone — same Wi-Fi network or VPN.
2. Open BirdEcho → **Connect your station** → choose **BirdNET-Go**.
3. Enter the host URL, e.g. `http://192.168.1.100:8080`. BirdEcho will ping the station to verify the connection before saving.

No token or account needed. BirdNET-Go's `/api/v2` endpoints are public by default.

### BirdWeather (cloud)

1. Log in to [app.birdweather.com](https://app.birdweather.com) and copy your **API token** from account settings.
2. Find your **Station ID** on the station dashboard URL: `.../stations/12345`.
3. Open BirdEcho → **Connect your station** → choose **BirdWeather** → paste both values → tap **Connect**.

Your token is stored in the device's secure enclave (iOS Keychain / Android Keystore). It is sent only to the BirdWeather API, never logged or cached in plain text.

---

## FAQ & Troubleshooting

**Which connection mode should I use?**
If your BirdNET-Pi or BirdNET-Go instance is on your home network (or reachable via VPN), use the direct mode — no third-party account needed. Use **BirdWeather** if you share detections publicly or only have a BirdWeather account.

**Where do I find my BirdWeather API token and Station ID?**
Log in to [app.birdweather.com](https://app.birdweather.com). Your **API token** is under account settings (top-right menu → Account). Your **Station ID** is the number at the end of your station's URL — e.g. `app.birdweather.com/stations/12345` → Station ID is `12345`.

**BirdEcho says "No detections found" but my station is running.**
- *BirdNET-Pi*: try opening `http://birdnetpi.local` in your phone's browser — if the web UI loads, BirdEcho should connect. Make sure you're on the same Wi-Fi network.
- *BirdNET-Go*: check that `/api/v2/ping` is reachable. BirdNET-Go v2.x is required.
- *BirdWeather*: check that BirdWeather integration is enabled on your station. Pull down to refresh after enabling.

**The app says "Invalid token or station" on connect.**
Double-check both values — the token is case-sensitive and the Station ID must be a number, not the station name. Try copying the token fresh from BirdWeather; some browsers add a trailing space.

**I connected successfully but the feed is empty.**
Your station may not have any detections yet. Pull down to refresh. If your station has detections on the BirdWeather website but not in BirdEcho, please [open an issue](https://github.com/arunrajiah/birdecho/issues).

**Notifications aren't arriving.**
Check that you granted notification permission when prompted. On Android, also check that battery optimisation isn't killing the app in the background. Note: server-side push alerts are a future feature; today's alerts are local-only and fire when a favourited species is detected.

**The Android map shows blank tiles.**
Markers and interactions work without a key. For full tile rendering, the app needs a Google Maps API key set at build time (`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`). iOS uses Apple Maps and always shows tiles.

**Is my token stored securely?**
Yes. BirdEcho uses `expo-secure-store`, which maps to iOS Keychain and Android Keystore. Your token is never logged, cached to disk in plain text, or sent anywhere other than the BirdWeather API.

**Can I monitor multiple stations?**
Yes — add as many stations as you like (any mix of BirdWeather, BirdNET-Go, and BirdNET-Pi) and switch between them with a tap from the Settings tab.

---

## Quickstart (development)

```bash
# clone
git clone https://github.com/arunrajiah/birdecho.git
cd birdecho

# install (project uses pnpm)
pnpm install

# start dev server
npx expo start
```

Press `i` for iOS simulator, `a` for Android emulator, or scan the QR code with [Expo Go](https://expo.dev/go).

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `EXPO_PUBLIC_SENTRY_DSN` | _(unset)_ | Optional. Enables Sentry error and performance tracking when set. |
| `EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | `0.2` | Optional. Sentry performance traces sample rate (0.0–1.0). |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | _(unset)_ | Optional. Google Maps API key for Android map tiles. |

Copy `.env.example` to `.env.local` at the project root and fill in the values you need. `.env.local` is git-ignored and never committed.

---

## Contributing

Pull requests are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening one.

Bug reports and feature requests go in [Issues](https://github.com/arunrajiah/birdecho/issues) — use the provided templates.

---

## Sponsors

If BirdEcho is useful to you, consider sponsoring continued development:

**[github.com/sponsors/arunrajiah](https://github.com/sponsors/arunrajiah)**

---

## Acknowledgments

- [BirdWeather](https://www.birdweather.com) — the API and hosted platform
- [BirdNET-Pi](https://github.com/mcguirepr89/BirdNET-Pi) by @mcguirepr89
- [BirdNET-Pi (Nachtzuster fork)](https://github.com/Nachtzuster/BirdNET-Pi) by @Nachtzuster
- [BirdNET-Go](https://github.com/tphakala/birdnet-go) by @tphakala
- [Cornell Lab of Ornithology](https://www.birds.cornell.edu) for the BirdNET research and model
- The [Expo](https://expo.dev) and [React Native](https://reactnative.dev) communities

---

## License

[MIT](LICENSE) © 2026 Arun Rajiah
