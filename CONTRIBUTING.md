# Contributing to BirdEcho

## Run locally

```bash
pnpm install
npx expo start
```

Press `i` for iOS simulator, `a` for Android emulator, or scan the QR code with Expo Go.

## Opening an issue

Use the bug report or feature request templates in `.github/ISSUE_TEMPLATE/`. Include your
platform, Expo SDK version, and steps to reproduce.

## Commit style

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add species detail screen
fix: correct confidence score display
chore: bump expo-router to 6.1.0
docs: add setup instructions to README
```

## Pull requests

- One concern per PR.
- All CI checks must pass before merge.
- New behaviour requires a test or a manual verification note in the PR description.
