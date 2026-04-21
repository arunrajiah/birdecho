# r/selfhosted post — draft

> Target subreddit: r/selfhosted
> Flair: App

---

**Title:** BirdEcho — open-source mobile app companion for self-hosted BirdNET-Pi / BirdNET-Go bird detectors

---

If you're running **BirdNET-Pi** or **BirdNET-Go** — the Raspberry Pi / server-side audio bird detection systems — and you want a native mobile interface instead of juggling browser tabs, I made BirdEcho.

**What it is:**

A React Native / Expo app (Android APK on GitHub Releases, iOS community builds) that connects to your station via the BirdWeather API. Credentials are stored on-device in the OS secure enclave (Keychain / Keystore), never sent anywhere except the BirdWeather API.

**Features:**

- Live detection feed, auto-refreshed every 60 seconds
- Audio playback for each detection
- Species browser and per-species history
- 14-day detection bar chart
- Favorites with local push notifications (once per species per day)
- Share sightings as image cards
- Light / dark mode

**Self-hostable? Sort of.** The app itself is MIT-licensed and builds locally with `pnpm install && npx expo start`. The backend is the BirdWeather API (`app.birdweather.com`), which is the hosted service that BirdNET-Pi and BirdNET-Go can push data to. If you're already pushing to BirdWeather, BirdEcho works with your existing setup.

GitHub: https://github.com/arunrajiah/birdecho  
Android APK: https://github.com/arunrajiah/birdecho/releases
