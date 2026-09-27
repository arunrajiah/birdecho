# Wear OS launch posts (v0.10.0)

Drafts for announcing the Wear OS glance. Post only where the watch app actually helps:
BirdNET-Pi is not supported on the watch, so the BirdNET-Pi discussions are skipped.

Be upfront in every post that this is a first release tested on the emulator.

---

## 1. GitHub Discussions / release announcement (birdecho repo)

**Title:** BirdEcho v0.10.0: your bird station on your wrist (Wear OS)

BirdEcho v0.10.0 adds a Wear OS companion: a tile and a small watch app showing your station's latest detection, when it happened, and today's count.

- The watch fetches on its own about every 15 minutes, so it works with the phone app closed.
- Setup is automatic: the phone app sends your active station to the watch.
- BirdWeather and BirdNET-Go stations are supported. BirdNET-Pi is not yet.
- Wear OS 3 or newer.

Install `birdecho-wear.apk` from the release page alongside the GitHub phone APK (they must share a signing key, so the Play build cannot pair with it yet).

This is a first release, tested on the Wear OS emulator. If you try it on a real watch, I would love to hear how it goes, good or bad.

Also fixed in this release: the BirdWeather "today" count and all-time totals were wrong.

https://github.com/arunrajiah/birdecho/releases/tag/v0.10.0

---

## 2. r/BirdNET

**Title:** BirdEcho (open-source companion app) now has a Wear OS tile: latest detection and today's count on your watch

I maintain BirdEcho, a free, MIT-licensed Android companion app for BirdNET-Go, BirdNET-Pi and BirdWeather stations. v0.10.0 adds a Wear OS tile and watch app.

What it shows: station name, the latest species, the time it was heard, and how many detections today.

How it works: the watch talks to your station directly (BirdWeather's API, or your BirdNET-Go instance over your network) and refreshes about every 15 minutes. The phone app sends it your station details, so there is nothing to type on the watch.

Limits, honestly:
- BirdWeather and BirdNET-Go only for now. BirdNET-Pi support on the watch is next.
- Sideload only for now (APK on GitHub Releases), paired with the GitHub phone APK.
- First release, tested on the Wear OS emulator. Testers with real watches are very welcome.

Release: https://github.com/arunrajiah/birdecho/releases/tag/v0.10.0
Source (MIT): https://github.com/arunrajiah/birdecho

---

## 3. BirdNET-Go discussions

**Title:** BirdEcho v0.10.0: Wear OS tile for BirdNET-Go stations

BirdEcho (open-source Android companion, connects directly to BirdNET-Go over your LAN via the v2 API) now has a Wear OS tile and watch app showing the latest detection and today's count.

The watch calls `/api/v2/detections` and `/api/v2/analytics/time/daily` itself, so it needs to reach your BirdNET-Go host: on the same Wi-Fi, or through whatever remote access you already use. No cloud account involved.

It is a first release, tested on the emulator against BirdWeather; the BirdNET-Go path has not been run against a live instance yet, so reports from real setups are especially useful.

Release: https://github.com/arunrajiah/birdecho/releases/tag/v0.10.0

---

## 4. r/selfhosted

**Title:** BirdEcho v0.10.0: Wear OS tile for your self-hosted BirdNET-Go station (open source, no cloud)

Short version of post 3, with the self-hosted angle: the watch talks straight to your BirdNET-Go instance, no account, no telemetry, MIT licensed. Sideloaded APK from GitHub Releases. First release, feedback welcome.

https://github.com/arunrajiah/birdecho
