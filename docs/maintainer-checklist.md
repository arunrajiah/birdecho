# Maintainer checklist

Reference checklist for recurring maintenance tasks.

## On every PR merged to `main`

- [ ] CI is green (lint + typecheck)
- [ ] CHANGELOG.md entry added under `[Unreleased]` if the change is user-facing
- [ ] No `console.log` calls left in production code paths
- [ ] No new env vars added without updating the README environment variables table

## Before each release

- [ ] All `[Unreleased]` entries in CHANGELOG.md moved to the new version section with today's date
- [ ] `expo.version` in `app.json` matches the tag
- [ ] `version` in `package.json` matches the tag
- [ ] `pnpm install --frozen-lockfile` passes (no lockfile drift)
- [ ] `npx tsc --noEmit` passes
- [ ] `npx expo lint` passes
- [ ] Manually tested on at least one physical Android device or emulator
- [ ] Release workflow triggered (`git tag vX.Y.Z && git push origin vX.Y.Z`)
- [ ] GitHub Release page verified (APK attached, changelog text correct)

## Monthly (while active)

- [ ] Check for Expo SDK updates: `npx expo install --check`
- [ ] Review open issues and PRs; label or close stale ones
- [ ] Check BirdWeather API changelog or developer communications for breaking changes
- [ ] Update [docs/supporters.md](supporters.md) if new sponsors have joined

## Quarterly

- [ ] Review SECURITY.md — is the supported version range still accurate?
- [ ] Check dependency health: `pnpm outdated`
- [ ] Review EAS build profile configurations in `eas.json`
- [ ] Post a brief update in community threads (BirdNET-Pi Discussions, etc.) if there have been meaningful changes

## If a security vulnerability is reported

1. Acknowledge within 72 hours via the SECURITY.md private disclosure path
2. Assess severity
3. Patch on a private branch
4. Tag a patch release and publish
5. Add a note to CHANGELOG.md and SECURITY.md
6. Credit the reporter if they consent
