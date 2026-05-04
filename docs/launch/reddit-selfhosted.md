# r/selfhosted post — draft

> Target subreddit: r/selfhosted
> Flair: App

---

**Title:** BirdEcho — open-source mobile app for self-hosted BirdNET-Go / BirdNET-Pi bird detectors (no cloud required)

---

If you're running **BirdNET-Go** or **BirdNET-Pi** and want a native mobile interface instead of a browser tab, I made BirdEcho.

**The key thing for the self-hosted crowd:** BirdNET-Go mode connects directly to your local instance over your LAN — no BirdWeather account, no cloud, no API key. You just point it at `http://192.168.x.x:8080` and it talks to the BirdNET-Go HTTP API directly. BirdWeather mode is also available if you already use it.

**Features:**

- Live detection feed, auto-refreshed every 60 seconds
- Audio playback for each detection
- Species browser and per-species detection history
- 14-day detection bar chart
- Favorites with local notifications (once per species per day)
- Share sightings as image cards
- Light / dark mode
- Timestamps in your station's timezone

**Privacy:** credentials (if using BirdWeather mode) are stored in the device secure enclave (iOS Keychain / Android Keystore), never sent anywhere except the BirdWeather API. BirdNET-Go mode requires no credentials at all — the API is read-only public by default.

MIT licensed, Android APK on GitHub Releases. React Native / Expo so community iOS builds are possible.

GitHub: https://github.com/arunrajiah/birdecho  
Android APK: https://github.com/arunrajiah/birdecho/releases
