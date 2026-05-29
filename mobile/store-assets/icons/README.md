# App Icon assets

> Spec ref: requirements.md §R5.7 — "designed in a palette that nods to Iraqi
> colors without being exclusionary".

## Required sizes

### Android (place under `mobile/android/app/src/main/res/`)

| Density bucket | dimensions | filename |
|---|---|---|
| `mipmap-mdpi` | 48×48 | `ic_launcher.png`, `ic_launcher_round.png` |
| `mipmap-hdpi` | 72×72 | same |
| `mipmap-xhdpi` | 96×96 | same |
| `mipmap-xxhdpi` | 144×144 | same |
| `mipmap-xxxhdpi` | 192×192 | same |
| `mipmap-anydpi-v26` | — | `ic_launcher.xml` referencing adaptive layers |

Adaptive icon layers (108×108 dp each, safe zone 66×66 dp):
- `ic_launcher_foreground.xml` — Z mark on transparent
- `ic_launcher_background.xml` — brand gradient (deep ink #0c0d10 → warm accent #c9a13a)

Play Store listing icon: **512×512 PNG** (32-bit, no transparency) at
`mobile/store-assets/icons/play-store-512.png`.

### iOS (place under `mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/`)

All required by `Contents.json`. Use Xcode's icon-set generator or run
the included script (see below).

| Idiom | Size | Scale | Pixels |
|---|---|---|---|
| iphone | 20pt | @2x, @3x | 40, 60 |
| iphone | 29pt | @2x, @3x | 58, 87 |
| iphone | 40pt | @2x, @3x | 80, 120 |
| iphone | 60pt | @2x, @3x | 120, 180 |
| ipad | 20pt, 29pt, 40pt, 76pt, 83.5pt | @1x, @2x | 20…167 |
| App Store marketing | 1024pt | @1x | **1024×1024** (no alpha) |

App Store listing icon: **1024×1024 PNG, no alpha channel** at
`mobile/store-assets/icons/app-store-1024.png`.

## Placeholder files

The following are placeholders pending design contractor handoff
(T-G.5.7). DO NOT ship to store until replaced with real artwork.

- `mobile/store-assets/icons/play-store-512.png` — 512×512 placeholder
- `mobile/store-assets/icons/app-store-1024.png` — 1024×1024 placeholder
- `mobile/store-assets/icons/adaptive-foreground.svg` — vector source
- `mobile/store-assets/icons/adaptive-background.svg` — vector source

## Generation script

Once vectors land, generate raster sizes:

```bash
# Android adaptive (108dp foreground + background)
inkscape -w 432 -h 432 adaptive-foreground.svg -o ../../android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png

# Play Store 512
inkscape -w 512 -h 512 master-square.svg -o play-store-512.png

# iOS 1024
inkscape -w 1024 -h 1024 master-square.svg -o app-store-1024.png
```

A `make icons` target in `mobile/Makefile` automates all sizes once
master SVG is in place.
