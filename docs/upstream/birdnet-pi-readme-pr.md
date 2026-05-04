# BirdNET-Pi README PR — draft

> Target repo: https://github.com/mcguirepr89/BirdNET-Pi
> PR type: docs
> Section to add: "Community tools" or "Related projects" (check current README structure first)

---

**PR title:** docs: add BirdEcho mobile companion app to related projects

**PR body:**

## What this changes

Adds a one-line mention of BirdEcho — an open-source mobile companion app for BirdNET-Pi stations — to the Related Projects or Community Tools section of the README.

## Proposed addition

```markdown
- **[BirdEcho](https://github.com/arunrajiah/birdecho)** — open-source Android/iOS companion app.
  Connects to your station via BirdWeather (if enabled) or directly to a BirdNET-Go instance
  over your local network. Live detection feed, audio playback, species browser, 14-day chart,
  and local notifications for favourite species. MIT licensed.
```

## Notes

- BirdEcho currently connects via the BirdWeather API (for BirdNET-Pi) or directly to BirdNET-Go's `/api/v2` REST API. Direct BirdNET-Pi HTTP API support is on the near-term roadmap.
- It is not affiliated with or endorsed by the BirdNET-Pi project.
- Happy to adjust the wording or placement to match the project's conventions.

---

> **Before opening:** read mcguirepr89/BirdNET-Pi's CONTRIBUTING guide and check whether such additions are welcome. If the project prefers a Discussions thread over a PR, use that instead.
