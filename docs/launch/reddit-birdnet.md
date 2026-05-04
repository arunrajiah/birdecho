# r/BirdNET post — draft

> Target subreddit: r/BirdNET (or the closest active community for BirdNET users)
> Flair: App / Tools

---

**Title:** BirdEcho — open-source mobile companion for BirdNET-Go / BirdNET-Pi / BirdWeather stations

---

I built an open-source Android app called **BirdEcho** for anyone running a BirdNET-Go, BirdNET-Pi, or BirdWeather station who wants a native phone interface.

**Two connection modes:**

- **BirdNET-Go direct** — connects straight to your local BirdNET-Go instance over your home network. No BirdWeather account needed. Just enter `http://192.168.x.x:8080`.
- **BirdWeather** — connects via the BirdWeather API using your token and station ID.

**What it gives you:**

- Live detection feed (60-second polling, pull-to-refresh, infinite scroll)
- Audio playback for each detection
- Species browser and per-species detection history
- 14-day detection bar chart + headline stats
- Favorites — star a species and get a local notification the first time it appears each day
- Share sightings as image cards
- Dark mode, station timezone-aware timestamps

**What it is not:** a bird-ID app. It does not touch your microphone or run any model. It shows what your station already detected.

Android APK: https://github.com/arunrajiah/birdecho/releases  
Source (MIT): https://github.com/arunrajiah/birdecho

Happy to answer questions — bug reports and PRs welcome.
