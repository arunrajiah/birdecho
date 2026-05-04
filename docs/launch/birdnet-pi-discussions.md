# BirdNET-Pi Discussions post — draft

> Post in the BirdNET-Pi GitHub Discussions under "Show and tell" or equivalent.

---

**Subject:** BirdEcho — a mobile companion app for BirdNET-Pi / BirdNET-Go stations

Hi everyone,

I've been running BirdNET-Pi for a while and kept wanting a lightweight way to check my station from my phone without opening a browser. I built **BirdEcho** — a React Native app that puts your station's detections on your phone.

**Two connection modes:**

- **BirdNET-Go direct** — connects straight to a local BirdNET-Go instance over your LAN via its `/api/v2` API. No BirdWeather account or cloud needed — just enter your local IP.
- **BirdWeather** — connects via the BirdWeather API for stations that already push to BirdWeather (including BirdNET-Pi setups).

**What it does:**

- Live detection feed, refreshed every 60 seconds
- Audio playback for each detection
- Species browser with per-species detection history
- 14-day stats chart and headline totals
- Favorites — star a species and get a local notification the first time it appears each day
- Share a sighting as an image card
- Dark mode, timestamps in your station's timezone

**What it does not do:**

BirdEcho is not a bird-ID app. It does not listen to your microphone or run any model. It only surfaces what your station has already detected.

**Download / install:**

Signed Android APK on GitHub Releases: https://github.com/arunrajiah/birdecho/releases

iOS community builds: see CONTRIBUTING.md in the repo (EAS build profiles are set up).

**Source:**

https://github.com/arunrajiah/birdecho — MIT licensed.

Direct BirdNET-Pi HTTP API support (without needing BirdWeather) is on the near-term roadmap — PRs very welcome if anyone wants to tackle it.

Happy to hear if this is useful, and pull requests are always welcome.

— Arun
