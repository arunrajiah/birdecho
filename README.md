<div align="center">

# Perch

**Your backyard bird station, on your phone.**

[![CI](https://github.com/arunrajiah/perch/actions/workflows/ci.yml/badge.svg)](https://github.com/arunrajiah/perch/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/arunrajiah/perch)](https://github.com/arunrajiah/perch/releases)
[![Sponsors ❤️](https://img.shields.io/badge/Sponsors-%E2%9D%A4%EF%B8%8F-ea4aaa)](https://github.com/sponsors/arunrajiah)

</div>

---

## What is Perch?

Perch is a companion app for existing **BirdNET-Pi**, **BirdNET-Go**, and **BirdWeather** audio detection stations. If you already have a station running, Perch lets you follow it from your phone — no station hardware required beyond what you already own.

Perch is **not** a bird-identification app. It does not listen to audio or identify birds itself. It surfaces what your station has already detected, puts the data in your pocket, and notifies you when a species you care about shows up.

---

## Screenshots

| Feed | Species | Stats |
|------|---------|-------|
| _(coming soon)_ | _(coming soon)_ | _(coming soon)_ |

> Want to contribute screenshots? See [docs/media/README.md](docs/media/README.md).

---

## Features

**Feed tab**
- Live-updating list of detections, auto-refreshed every 60 seconds
- Pull-to-refresh and infinite scroll pagination
- Tap any sighting to hear the recording and share a card

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
- Notification opt-in with Expo push token registration
- Disconnect and reconnect to a different station

---

## Download

**Android** — grab the latest signed APK from [GitHub Releases](https://github.com/arunrajiah/perch/releases).

**iOS** — community builds welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to build locally with EAS.

> F-Droid submission is in progress.

---

## Connecting your station

1. Log in to [app.birdweather.com](https://app.birdweather.com) and copy your **API token** from account settings.
2. Find your **Station ID** on the station dashboard URL: `.../stations/12345`.
3. Open Perch → **Connect your station** → paste both values → tap **Connect**.

Perch stores your token in the device's secure enclave (iOS Keychain / Android Keystore) via `expo-secure-store`. It is never sent anywhere except the BirdWeather API.

---

## Quickstart (development)

```bash
# clone
git clone https://github.com/arunrajiah/perch.git
cd perch

# install
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

Bug reports and feature requests go in [Issues](https://github.com/arunrajiah/perch/issues) — use the provided templates.

---

## Sponsors

If Perch is useful to you, consider sponsoring continued development:

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
