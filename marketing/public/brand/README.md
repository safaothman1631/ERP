# Brand assets

Placeholder assets currently committed:

- `favicon.svg`              — SVG favicon (32×32 viewBox, scalable)
- `logo.svg`                 — Horizontal lockup (240×56)
- `og/hero-1200x630.svg`     — Default OG card (replace with raster `.png` for max compatibility)
- `og/blog-template-1200x630.svg` — Blog OG base

## TODO (designer)

Replace with production assets before launch:

| File | Spec |
|------|------|
| `logo.svg`, `logo-mark.svg` | Vector, with and without wordmark, brand-red + ink dark |
| `favicon.ico`               | 16×16, 32×32, 48×48 |
| `favicon-32.png`            | 32×32 raster |
| `favicon-180.png`           | 180×180 Apple touch icon |
| `manifest-icon-192.png`     | 192×192 PWA icon (maskable) |
| `manifest-icon-512.png`     | 512×512 PWA icon (maskable) |
| `og/hero-1200x630.png`      | 1200×630 OG (rasterized) |
| `og/blog-template-1200x630.png` | 1200×630 blog OG base |
| `social/twitter-card-1200x600.png` | 1200×600 Twitter / X card |

Iraqi-flag-inspired palette (per `tailwind.config.mjs`):

- Primary action: `#e5495d` (muted brand red)
- Success / verified: `#2fa356` (muted brand green)
- Neutrals: ink-50 through ink-950

Avoid the literal Iraqi flag in OG cards (too political); the brand-red and accent-green nod is enough.
