# BirdWeather team outreach — draft

> Send to: tim@birdweather.com
> Tone: friendly introduction, not a sales pitch.

---

**Subject:** Open-source mobile companion app built on the BirdWeather API — BirdEcho

Hi BirdWeather team,

My name is Arun. I've been running a BirdNET-Pi station for a while and recently built an open-source mobile app called **BirdEcho** that uses your public API.

BirdEcho is a companion app — not a bird-ID tool. It connects to a user's existing BirdWeather station via their API token and station ID, and gives them a native mobile interface: live detection feed, audio playback, species browser, 14-day chart, and local notifications for favourite species. Credentials are stored only in the device secure enclave and sent only to the BirdWeather API.

In v0.2 I also added a **BirdNET-Go direct mode** that talks to the BirdNET-Go `/api/v2` REST API over a user's local network, without requiring a BirdWeather account. I wanted to be transparent about this — BirdEcho's BirdWeather mode still depends on your platform and I see that as the primary path for most users, but I wanted you to know the app now supports both.

The app is MIT licensed and available on GitHub: https://github.com/arunrajiah/birdecho. Android builds are on GitHub Releases; iOS community builds are supported via EAS.

A few things I wanted to flag:

1. **API usage** — BirdEcho polls `/stations/{id}/detections` and a few related endpoints at a 60-second interval, one station per user. I don't believe this puts unusual load on your infrastructure, but I wanted to be transparent.

2. **Attribution** — The app's README and in-app connect screen clearly attributes BirdWeather and links to your platform.

3. **No affiliation claim** — BirdEcho's metadata doesn't claim to be an official BirdWeather product.

If there's anything about how BirdEcho uses the API that you'd like me to change, I'm happy to do so. And if you think it might be useful to mention to your community, I'd appreciate that — but completely understand if it's not something you promote.

Thanks for building the platform that makes this possible.

— Arun Rajiah  
https://github.com/arunrajiah/birdecho
