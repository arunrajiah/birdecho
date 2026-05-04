# BirdNET-Go README PR — draft

> Target repo: https://github.com/tphakala/birdnet-go
> PR type: docs
> Section to add: "Community tools" or "Related projects" (check current README structure first)

---

**PR title:** docs: add BirdEcho mobile companion app to related projects

**PR body:**

## What this changes

Adds a one-line mention of BirdEcho — an open-source mobile companion app for BirdNET-Go stations — to the Related Projects or Community Tools section of the README.

## Proposed addition

```markdown
- **[BirdEcho](https://github.com/arunrajiah/birdecho)** — open-source Android/iOS companion app.
  Connects directly to your BirdNET-Go station over your local network via the `/api/v2` REST API —
  no BirdWeather account required. Live detection feed, audio playback, species browser, 14-day chart,
  and local notifications for favourite species. MIT licensed.
```

## Notes

- BirdEcho uses BirdNET-Go's public `/api/v2` endpoints directly — no cloud dependency, no BirdWeather account needed.
- It is not affiliated with or endorsed by the BirdNET-Go project.
- Happy to adjust wording or placement to match the project's conventions.

---

> **Before opening:** read tphakala/birdnet-go's CONTRIBUTING guide and check whether such additions are welcome. If the project prefers a Discussions thread over a PR, use that instead.
