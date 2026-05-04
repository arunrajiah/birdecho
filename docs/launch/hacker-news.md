# Hacker News — Show HN draft

> Post type: Show HN
> Keep it short; let the comments do the work.

---

**Title:** Show HN: BirdEcho – open-source mobile companion for self-hosted BirdNET-Go/BirdNET-Pi bird detectors

---

**Body:**

BirdNET-Pi and BirdNET-Go are open-source systems that run on a Raspberry Pi (or any Linux box) and use Cornell's BirdNET neural network to identify birds from an always-on microphone.

BirdEcho is a React Native / Expo app that puts your station's detections on your phone. It supports two modes:

**BirdNET-Go direct** — connects straight to your local BirdNET-Go instance over your LAN via the `/api/v2` REST API. No BirdWeather account or cloud dependency needed; just point it at your local IP. Plain HTTP (for LAN use) is explicitly supported.

**BirdWeather** — connects via the BirdWeather API (the hosted platform that BirdNET-Pi/Go can push to) using your token and station ID.

Features: live feed with 60s polling, audio playback, species browser, 14-day chart, favorites with local notifications, dark mode, station-timezone timestamps.

Not a bird-ID app — it surfaces detections your station already made.

Stack: Expo SDK 54, Expo Router v6, TanStack Query v5, Zustand v5, NativeWind v4, FlashList.

Android APK on GitHub Releases. iOS: community builds (EAS). MIT licensed.

https://github.com/arunrajiah/birdecho

---

**Anticipated comments and short answers:**

*"Why not just use the BirdWeather website or BirdNET-Go's built-in web UI?"*  
The web UIs are good but not optimised for mobile, don't do push notifications, and require a browser. BirdEcho is a native experience with audio playback inline.

*"Does this require BirdWeather? Can it talk to BirdNET-Go / BirdNET-Pi directly?"*  
BirdNET-Go direct is fully supported — no BirdWeather account needed. BirdNET-Pi direct API support is on the roadmap (it uses a different API surface).

*"Why Expo and not bare React Native?"*  
Managed Expo keeps the setup frictionless for contributors who don't want to touch Xcode or Android Studio. EAS handles production builds. The new architecture is enabled.

*"Security?"*  
BirdWeather tokens are stored in the OS secure enclave (Keychain/Keystore), moved to `X-Auth-Token` header (never in URLs), and stripped from Sentry events. GitHub Actions builds are SHA-pinned. BirdNET-Go mode needs no credentials — the API is read-only public.
