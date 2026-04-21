# r/BirdNET post — draft

> Target subreddit: r/BirdNET (or the closest active community for BirdNET users)
> Flair: App / Tools

---

**Title:** BirdEcho — open-source mobile companion for BirdNET-Pi / BirdNET-Go / BirdWeather stations

---

I built a small open-source Android (and community-built iOS) app called **BirdEcho** for anyone running a self-hosted BirdNET-Pi, BirdNET-Go, or BirdWeather station.

It connects to your station via the BirdWeather API and gives you:

- A live detection feed (60-second polling, pull-to-refresh, infinite scroll)
- Per-sighting detail with audio playback
- Species browser
- 14-day detection chart
- Favorites with daily local notifications when a starred species is detected
- Share sightings as image cards

**It is not a bird-ID app** — it doesn't listen to audio or run any model. It just shows what your station already detected.

Android APK: https://github.com/arunrajiah/birdecho/releases  
Source (MIT): https://github.com/arunrajiah/birdecho

Happy to answer questions. Bug reports and PRs welcome.
