# BirdWeather team outreach — draft

> Send via the BirdWeather contact form or to their support/community email.
> Tone: friendly introduction, not a sales pitch.

---

**Subject:** Open-source mobile companion app built on the BirdWeather API — Perch

Hi BirdWeather team,

My name is Arun. I've been running a BirdNET-Pi station for a while and recently built an open-source mobile app called **Perch** that uses your public API.

Perch is a companion app — not a bird-ID tool. It connects to a user's existing BirdWeather station via their API token and station ID, and gives them a native mobile interface: live detection feed, audio playback, species browser, 14-day chart, and local notifications for favourite species. Credentials are stored only in the device secure enclave.

The app is MIT licensed and available on GitHub: https://github.com/arunrajiah/perch. Android builds are on GitHub Releases; iOS community builds are supported via EAS.

A few things I wanted to flag:

1. **API usage** — Perch polls `/stations/{id}/detections` and a few related endpoints at a 60-second interval, one station per user. I don't believe this puts unusual load on your infrastructure, but I wanted to be transparent.

2. **Attribution** — The app's README and in-app connect screen clearly attributes BirdWeather and links to your platform.

3. **No affiliation claim** — Perch's metadata doesn't claim to be an official BirdWeather product.

If there's anything about how Perch uses the API that you'd like me to change, I'm happy to do so. And if you think it might be useful to mention to your community, I'd appreciate that — but completely understand if it's not something you promote.

Thanks for building the platform that makes this possible.

— Arun Rajiah  
https://github.com/arunrajiah/perch
