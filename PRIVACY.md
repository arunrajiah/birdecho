# BirdEcho privacy policy

Last updated: 7 November 2026

BirdEcho shows the detections of a bird station you already run (BirdNET-Pi, BirdNET-Go or BirdWeather). It has no
accounts and no analytics, and the developer receives no data about you or your use of the app.

## What stays on your phone
- The stations you add (their names, addresses and, for BirdWeather, your station token), your favourites, settings and
  a cache of the last 24 hours of detections. BirdWeather tokens are kept in the phone's secure storage (iOS Keychain,
  Android Keystore). Deleting the app deletes all of it.
- Notifications (favourite species, rare birds) are created on the phone itself; no notification server is involved.

## What the app contacts, and only when you use it
- **Your own station** on your home network (BirdNET-Pi, BirdNET-Go), to read its detections and audio.
- **BirdWeather** (app.birdweather.com), if you connect a BirdWeather station, using the token you enter.
  BirdWeather's own privacy policy applies.
- **Wikipedia and Wikimedia Commons**, to show species pictures and descriptions.
- **Wildlife Network** (wlnw.org), for nearby arrival dates and species pages. To suggest your area, Wildlife Network
  reads the approximate area of your internet address once; it is not stored. If you choose to register your station
  with Wildlife Network, the name, position and optional contact you enter are sent to it; see https://wlnw.org/privacy.
- **Apple Maps** (on iPhone) or Google Maps (on Android) to draw the station map.

## Crash reports
Builds published by the developer do not send crash reports. The code can send anonymous error reports (Sentry) only
if a build is made with a Sentry address set; such reports strip station tokens and addresses.

## Children
BirdEcho is not directed at children and collects no personal data from anyone.

## Contact
Questions or requests: arunrajiah@gmail.com, or open an issue at https://github.com/arunrajiah/birdecho/issues.
