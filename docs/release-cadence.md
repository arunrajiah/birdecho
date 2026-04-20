# Release cadence

## Goal

Predictable, low-drama releases. Ship when things are ready, not on a fixed clock — but don't let the `main` branch drift for months without a tag.

## Rough cadence

| Type | Trigger | Frequency |
|---|---|---|
| Patch (`0.x.y`) | Bug fix or small improvement | As needed, no minimum wait |
| Minor (`0.x.0`) | New feature or meaningful UX change | Aim for every 4–8 weeks while active |
| Major (`1.0.0`) | When the app is considered stable and in wide use | No timeline set |

## Release process

1. Update `CHANGELOG.md` — add a `[version] — YYYY-MM-DD` section with everything since the last tag.
2. Bump the version in `app.json` (`expo.version`) and `package.json` (`version`).
3. Commit: `chore: bump version to X.Y.Z`
4. Tag: `git tag vX.Y.Z && git push origin vX.Y.Z`
5. The GitHub Actions `release.yml` workflow fires automatically:
   - Builds a signed Android APK via EAS (`preview` profile)
   - Creates a GitHub Release with the CHANGELOG excerpt and the APK attached
6. Verify the release page looks correct.
7. Post in community threads if the release includes user-facing changes.

## Hotfix process

For a critical bug on a live release:

1. Branch from the tag: `git checkout -b hotfix/vX.Y.Z+1 vX.Y.Z`
2. Fix and test.
3. PR into `main`, merge.
4. Tag from `main` as `vX.Y.Z+1`.
5. Normal release process from step 5 above.

## Pre-release tags

Tags containing a hyphen (e.g. `v0.2.0-beta.1`) are published as GitHub pre-releases automatically by the release workflow.

## What does NOT block a release

- App Store / Play Store status — Android APK on GitHub Releases is the primary distribution channel for now.
- Perfect test coverage — the CI gate (lint + typecheck) is the bar.
