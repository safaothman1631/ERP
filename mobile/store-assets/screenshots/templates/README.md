# Screenshot templates

> Spec refs: requirements.md §R5.5–§R5.6, tasks.md T-G.5.8, T-G.5.9.

## Required resolutions

### Play Store

| Device class | Resolution | Count |
|---|---|---|
| Phone | 1080×1920 portrait | 4–8 |
| 7" tablet | 1200×1920 portrait | 2–4 |
| 10" tablet | 1920×1200 landscape | 2–4 |
| Feature graphic | 1024×500 | 1 |

### App Store

| Device class | Resolution | Count |
|---|---|---|
| iPhone 6.7" (Pro Max) | 1290×2796 | 3–10 |
| iPhone 6.5" (Plus) | 1284×2778 | 3–10 |
| iPhone 5.5" (legacy) | 1242×2208 | 3–10 |
| iPad 12.9" | 2048×2732 | 2–10 |
| iPad 11" | 1668×2388 | 2–10 |

## Template files (Figma)

Source designs live in the design team's Figma file `Zoho-Kurdish/Mobile/StoreScreens`.
Export presets:

- **Variant A (`with-frame`)** — phone bezel overlay (recommended for Play).
- **Variant B (`bare`)** — clean shot with side caption (recommended for App Store
  because Apple is strict about marketing imagery overlapping the chrome).

Captions are localized — three variants per shot (`-ku`, `-ar`, `-en`).

## Capture script

Real-device captures are produced via Fastlane Snapshot (iOS) + Screengrab
(Android). Run from the `mobile/` root:

```bash
# Android — captures on the FTL device matrix
cd android
bundle exec fastlane screengrab

# iOS — captures via UI tests
cd ios
bundle exec fastlane snapshot
```

Output lands under `mobile/store-assets/screenshots/output/<locale>/<device>/`.

## Acceptance

Each release replaces the previous screenshots ONLY if the UI changed
materially (≥ 3 strings or any layout change). Otherwise re-use existing
shots to keep the store listing stable (Apple often re-reviews when
screenshots change).

## Placeholder set

The current screenshots committed to `mobile/store-assets/screenshots/`
are exported once a designer renders them in Figma. Until then this folder
contains README files explaining the requirement and an empty `output/`
directory.
