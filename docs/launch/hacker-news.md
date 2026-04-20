# Hacker News — Show HN draft

> Post type: Show HN
> Keep it short; let the comments do the work.

---

**Title:** Show HN: Perch – open-source mobile companion for BirdNET-Pi/BirdNET-Go bird detector stations

---

**Body:**

BirdNET-Pi and BirdNET-Go are open-source systems that run on a Raspberry Pi (or any Linux box) and use Cornell's BirdNET neural network to identify birds from an always-on microphone. They push detections to BirdWeather, a hosted platform with a REST API.

Perch is a React Native / Expo app that talks to the BirdWeather API and puts your station's detections on your phone. Features: live feed with 60s polling, audio playback, species browser, 14-day chart, favorites with local notifications, dark mode.

It is deliberately not a bird-ID app — it surfaces detections your station already made.

Stack: Expo SDK 54, Expo Router, TanStack Query, Zustand, NativeWind, FlashList.

Android APK on GitHub Releases. iOS: community builds (see CONTRIBUTING). MIT licensed.

https://github.com/arunrajiah/perch

---

**Anticipated comments and short answers:**

*"Why not just use the BirdWeather website?"*  
The web UI is good but not optimised for mobile, doesn't do push notifications, and requires a browser. Perch is a native experience.

*"Does this require BirdWeather? Can it talk to a self-hosted BirdNET-Pi directly?"*  
Currently yes, it requires the BirdWeather API. Direct BirdNET-Pi HTTP API support is a planned future feature — contributions welcome.

*"Why Expo and not bare React Native?"*  
Managed Expo keeps the setup frictionless for contributors who don't want to touch Xcode or Android Studio. EAS handles production builds.
