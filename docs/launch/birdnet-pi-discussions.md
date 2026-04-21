# BirdNET-Pi Discussions post — draft

> Post in the BirdNET-Pi GitHub Discussions under "Show and tell" or equivalent.

---

**Subject:** BirdEcho — a mobile companion app for your BirdNET-Pi station

Hi everyone,

I've been running BirdNET-Pi for a while and kept wanting a lightweight way to check my station from my phone without opening a browser. So I built **BirdEcho** — a React Native app that talks to the BirdWeather API and puts your station's detections on your phone.

**What it does:**

- Live detection feed, refreshed every 60 seconds
- Species browser with detection history
- 14-day stats chart
- Favorites — star a species and get a local notification the first time it appears each day
- Share a sighting as an image card
- Dark mode

**What it does not do:**

BirdEcho is not a bird-ID app. It does not listen to your microphone or identify birds itself. It only surfaces what BirdNET-Pi has already detected via the BirdWeather API.

**Download / install:**

Signed Android APK on GitHub Releases: https://github.com/arunrajiah/birdecho/releases

iOS community builds: see CONTRIBUTING.md in the repo.

**Source:**

https://github.com/arunrajiah/birdecho — MIT licensed.

Happy to hear if this is useful to anyone, and pull requests are very welcome.

— Arun
