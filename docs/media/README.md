# Media asset checklist

This directory holds screenshots, demo GIFs, and other visual assets used in the README and app store listings.

## Capture checklist

Screenshots should be taken on a physical device or a clean simulator/emulator with realistic data. Use the same device frame for all shots in a set.

### Screens to capture

- [ ] **Feed tab** — at least 6 sighting rows visible; a mix of confidence levels (green, amber)
- [ ] **Sighting detail** — species photo, confidence pill, play button visible
- [ ] **Species tab** — species list with thumbnails
- [ ] **Species detail** — photo, detection count, star button active
- [ ] **Stats tab** — bar chart with 14 days of data, top species list below
- [ ] **Favorites tab** — at least 3 starred species
- [ ] **Settings tab** — theme toggle, notifications switch
- [ ] **Connect screen** — empty state for onboarding docs

### Dark mode variants

Capture each screen above in both light and dark mode where possible.

### Demo GIF

- [ ] 30–60 second screen recording covering: connect → feed → tap sighting → play audio → share
- [ ] Export at 2× resolution, crop to device frame, max 10 MB

## Naming convention

```
{screen}-{variant}-{device}.png
# examples:
feed-light-iphone15.png
feed-dark-pixel7.png
stats-light-iphone15.png
demo.gif
```

## Where assets are used

| Asset | Location |
|---|---|
| Feed, Species, Stats screenshots | README.md screenshots table |
| Demo GIF | README.md hero (when added) |
| All screenshots | App store listing (future) |

## Submitting assets

Open a pull request adding files to this directory. Reference the checklist items you've covered in the PR description.
