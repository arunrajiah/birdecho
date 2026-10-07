# Media asset checklist

This directory holds screenshots, demo GIFs, and other visual assets used in the README and app store listings.

## Capture checklist

Screenshots should be taken on a physical device or a clean simulator/emulator with realistic data. Use the same device frame for all shots in a set.

### Screens to capture

- [x] **Feed tab**: Today card plus sighting rows with mixed confidence: `feed-light-emulator.jpg`, `feed-dark-emulator.jpg`
- [x] **Sighting detail**: photo, confidence pill: `sighting-light-emulator.jpg`
- [x] **Species tab**: list with thumbnails: `species-list-light-emulator.jpg`
- [x] **Species detail**: photo, detection count, In your area: `species-light-emulator.jpg`
- [x] **Stats tab**: chart and top species: `stats-dark-emulator.jpg`; Near you on WildNetwork: `stats-nearyou-light-emulator.jpg`
- [x] **Settings tab**: `settings-dark-emulator.jpg`
- [ ] **Favorites tab**
- [ ] **Connect screen**

The current set was captured on the Android emulator with the demo station (v0.11.0). Play Store copies live in `fastlane/metadata/android/en-US/images/phoneScreenshots/`.

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
