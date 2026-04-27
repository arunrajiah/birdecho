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

BirdEcho is a companion app for existing **BirdNET-Pi**, **BirdNET-Go**, and **BirdWeather** audio detection stations. If you already have a station running, BirdEcho lets you follow it from your phone — no station hardware required beyond what you already own.

BirdEcho is **not** a bird-identification app. It does not listen to audio or identify birds itself. It surfaces what your station has already detected, puts the data in your pocket, and notifies you when a species you care about shows up.

---

## Screenshots

Screenshots from a live station are coming once early users submit them.

If you're running BirdEcho against your station, contributions are very welcome — see [docs/media/README.md](docs/media/README.md) for the capture checklist and how to submit a PR.

---

## Features

**Feed tab**
- Live-updating list of detections, auto-refreshed every 60 seconds
- Pull-to-refresh and infinite scroll pagination
- Tap any sighting to hear the recording and share a card
- Detection times shown in your station's local timezone

**Species tab**
- Browse every species your station has ever detected
- Tap a species for a detail page with recent sightings

**Stats tab**
- Headline totals: detections today, this week, unique species
- 14-day detection bar chart

**Favorites tab**
- Star any species
- Get a local notification the first time a starred species appears each day

**Settings tab**
- Light / Dark / System theme
- Notification permission opt-in (push alerts coming in a future release)
- Disconnect and reconnect to a different station

---

## Download

**Android** — grab the latest signed APK from [GitHub Releases](https://github.com/arunrajiah/birdecho/releases).

**iOS** — community builds welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to build locally with EAS.

> F-Droid submission is in progress.

---

## Connecting your station

### BirdNET-Go (direct, no cloud required)

1. Make sure your BirdNET-Go instance is reachable from your phone — either on the same Wi-Fi network or via VPN.
2. Open BirdEcho → **Connect your station** → choose **BirdNET-Go**.
3. Enter the host URL, e.g. `http://192.168.1.100:8080`. BirdEcho will ping the station to verify the connection before saving.

No token or account needed. BirdNET-Go's `/api/v2` endpoints are public by default.

### BirdWeather (cloud)

1. Log in to [app.birdweather.com](https://app.birdweather.com) and copy your **API token** from account settings.
2. Find your **Station ID** on the station dashboard URL: `.../stations/12345`.
3. Open BirdEcho → **Connect your station** → choose **BirdWeather** → paste both values → tap **Connect**.

Your token is stored in the device's secure enclave (iOS Keychain / Android Keystore) via `expo-secure-store`. It is sent only to the BirdWeather API, never logged or cached in plain text.

---

## FAQ & Troubleshooting

**Which connection mode should I use?**
If your BirdNET-Go instance is on your home network (or reachable via VPN), use **BirdNET-Go** — it's direct and requires no third-party account. If you use BirdWeather to share detections publicly or you're on a BirdNET-Pi, use **BirdWeather**.

**Where do I find my BirdWeather API token and Station ID?**
Log in to [app.birdweather.com](https://app.birdweather.com). Your **API token** is under account settings (top-right menu → Account). Your **Station ID** is the number at the end of your station's URL — e.g. `app.birdweather.com/stations/12345` → Station ID is `12345`.

**BirdEcho says "No detections found" but my station is running.**
- *BirdNET-Go*: check that your phone can reach the host URL. Try opening it in your phone's browser — if you see a response, BirdEcho should work too. Make sure BirdNET-Go v2.x is running (the app uses `/api/v2`).
- *BirdWeather*: check that BirdWeather integration is enabled on your station. On BirdNET-Pi enable it under Tools → Settings → BirdWeather. On BirdNET-Go enable it in `config.yaml` under `birdweather`. Pull down to refresh after enabling.

**The app says "Invalid token or station" on connect.**
Double-check both values — the token is case-sensitive and the Station ID must be a number, not the station name. Try copying the token fresh from BirdWeather; some browsers add a trailing space.

**I connected successfully but the feed is empty.**
Your station may not have any detections yet, or detections may be older than the default page. Pull down to refresh. If your station has detections on the BirdWeather website but not in BirdEcho, please [open an issue](https://github.com/arunrajiah/birdecho/issues).

**Notifications aren't arriving.**
On first use, BirdEcho asks for notification permission — check that you approved it. On Android, also check that battery optimisation isn't killing the app in the background. You can re-enable notifications any time from the Settings tab. Note: server-side push alerts are a future feature; today's alerts are local-only.

**Does BirdEcho work without BirdWeather?**
Yes — connect directly to a **BirdNET-Go** instance over your local network with no BirdWeather account needed. Direct BirdNET-Pi HTTP API support is on the [roadmap](ROADMAP.md).

**Is my token stored securely?**
Yes. BirdEcho uses `expo-secure-store`, which maps to iOS Keychain and Android Keystore. Your token is never logged, cached to disk in plain text, or sent anywhere other than the BirdWeather API.

**Can I use BirdEcho with multiple stations?**
One station at a time currently. Tap **Disconnect** in the Settings tab to switch to a different station. Multi-station support is on the [roadmap](ROADMAP.md).

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
- [BirdNET-Go](https://github.com/tphakala/birdnet-go) by @tphakala
- [Cornell Lab of Ornithology](https://www.birds.cornell.edu) for the BirdNET research and model
- The [Expo](https://expo.dev) and [React Native](https://reactnative.dev) communities

---

## License

[MIT](LICENSE) © 2026 Arun Rajiah
