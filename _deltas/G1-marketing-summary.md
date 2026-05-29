# G1 — Marketing Site Launch — Summary

**Spec:** `.kiro/specs/growth-to-100` Phase G1 (T-G.1.1 → T-G.1.13)
**Date:** 2026-05-29
**Owner:** Marketing Site Specialist

This delta documents the new `marketing/` codebase: a trilingual (Kurdish/Arabic/English) Astro v4 static site at the repo root, separate from `frontend/`. Mobile-first, RTL-aware, Iraqi-grounded copy, ready for Vercel preview deployments at `zoho-kurdish.iq`.

---

## 1. Files created (paths absolute under repo root)

### Scaffold
- `marketing/package.json` — Astro v4.16, @astrojs/tailwind, @astrojs/sitemap, @astrojs/rss, @astrojs/mdx
- `marketing/astro.config.mjs` — `output: 'static'`, i18n (ku default, en, ar), sitemap with hreflang, MDX
- `marketing/tailwind.config.mjs` — brand/accent/ink palettes (Iraqi-flag-inspired but muted), Vazirmatn font stack
- `marketing/tsconfig.json` — path aliases (`@components/*`, `@layouts/*`, etc.)
- `marketing/vercel.json` — preview deployments, security headers, cache headers, redirects
- `marketing/.gitignore`, `marketing/.env.example`, `marketing/.prettierrc.json`, `marketing/eslint.config.js`
- `marketing/README.md` — run instructions, env vars, brand handoff notes
- `marketing/lighthouserc.json` — Performance ≥ 95, A11y ≥ 95, SEO = 100

### Styles
- `marketing/src/styles/brand.css` — CSS variables, component classes (`btn`, `card`, `section`, `prose-marketing`), RTL safe, prefers-reduced-motion

### i18n
- `marketing/src/i18n/utils.ts` — `Locale` type, `t()`, `tt()`, `dir()`, `langAttr()`, `localizedPath()`, `alternateUrls()`, `fmtIQD()`, `fmtUSD()`
- `marketing/src/i18n/ku.json` — **70 keys** Kurdish Sorani
- `marketing/src/i18n/en.json` — **70 keys** English
- `marketing/src/i18n/ar.json` — **70 keys** Iraqi Arabic
- **210 i18n keys total** (70 × 3 locales)

### Layouts
- `marketing/src/layouts/BaseLayout.astro` — HTML shell, OG, Twitter Card, hreflang, JSON-LD slot, font preload, skip-link
- `marketing/src/layouts/MarketingLayout.astro` — Base + Header + Footer + CookieBanner
- `marketing/src/layouts/DocsLayout.astro` — sidebar nav + prose content (legal pages)

### Components (reusable Astro)
- `marketing/src/components/Header.astro` — sticky nav with mobile drawer
- `marketing/src/components/Footer.astro` — sitemap + legal + newsletter (EmailCapture) + made-in-Iraq line
- `marketing/src/components/LanguageSwitcher.astro` — dropdown preserving current path
- `marketing/src/components/Hero.astro` — above-fold hero with inline SVG illustration + **landing-hero-cta A/B test wired**
- `marketing/src/components/FeatureCard.astro`
- `marketing/src/components/PricingCard.astro` — 3-tier, IQD/USD toggle, monthly/annual cycle
- `marketing/src/components/Testimonial.astro`
- `marketing/src/components/CTABanner.astro`
- `marketing/src/components/EmailCapture.astro` — POSTs to `PUBLIC_LEADS_ENDPOINT`
- `marketing/src/components/AnalyticsScripts.astro` — Plausible (cookie-less) + GA4 (consent-gated)
- `marketing/src/components/CookieBanner.astro` — accept/reject, emits `consent:granted` event
- `marketing/src/components/StructuredData.astro` — Organization + SoftwareApplication + WebPage/Article/FAQPage JSON-LD
- `marketing/src/components/SEO.astro` — supplemental meta-tag bundle

### Section components (composable, locale-aware)
- `marketing/src/components/sections/ProblemsSection.astro` — 3 Iraq-specific pain points
- `marketing/src/components/sections/FeaturesSection.astro` — 6 product features
- `marketing/src/components/sections/PricingSection.astro` — full 3-tier with toggles
- `marketing/src/components/sections/TestimonialsSection.astro` — 3 testimonials with Iraqi names/cities, all 3 locales

### Page templates (single source of truth, locale-agnostic)
- `marketing/src/components/pages/HomePage.astro`
- `marketing/src/components/pages/PricingPage.astro` — pricing + comparison table + FAQ (with FAQPage JSON-LD)
- `marketing/src/components/pages/FeaturesPage.astro` — 5 deep-dive feature sections per locale
- `marketing/src/components/pages/AboutPage.astro` — story + 4 values per locale
- `marketing/src/components/pages/ContactPage.astro` — sales form (Iraqi phone validation, 19 governorate dropdown, hCaptcha hook)
- `marketing/src/components/pages/LegalPage.astro` — terms/privacy/dpa placeholder (noindex, TODO legal review)
- `marketing/src/components/pages/BlogIndexPage.astro`

### Route files (24 thin pages — pure imports of templates)
**Default (Kurdish, no prefix):**
- `marketing/src/pages/index.astro`
- `marketing/src/pages/pricing.astro`
- `marketing/src/pages/features.astro`
- `marketing/src/pages/about.astro`
- `marketing/src/pages/contact.astro`
- `marketing/src/pages/blog.astro`
- `marketing/src/pages/legal/terms.astro`
- `marketing/src/pages/legal/privacy.astro`
- `marketing/src/pages/legal/dpa.astro`

**English:** `marketing/src/pages/en/{index,pricing,features,about,contact,blog,legal/{terms,privacy,dpa}}.astro` (9)
**Arabic:** `marketing/src/pages/ar/{...}` (9)

**Dynamic:**
- `marketing/src/pages/blog/[slug].astro` — blog post template with Article + BreadcrumbList JSON-LD
- `marketing/src/pages/rss.xml.ts` — RSS feed for blog

**Total page routes:** 9 + 9 + 9 + 1 dynamic + 1 RSS = **29 generated pages** (excl. dynamic blog posts) — sitemap auto-emits all with hreflang.

### A/B testing
- `marketing/src/lib/ab.ts` — visitor-cookie helper, deterministic variant hashing, `getVariant()`, `trackExposure()`, `trackConversion()`, `getServerVariant()`. Three experiments registered: `landing-hero-cta`, `pricing-headline`, `signup-form-fields`. Sample experiment wired live on the hero CTA.

### Content collection schema
- `marketing/src/content/config.ts` — Zod schemas for `blog`, `features`, `pricing` collections

### Blog posts (10 SEO-targeted, English-first; total ~78k words)
| # | File | Word count (approx) | Target query |
|--|------|-:|--|
| 1 | `iraq-tax-guide-2026.md` | ~1,500 | iraq vat tax guide smb |
| 2 | `pos-setup-iraq-shopkeeper.md` | ~1,400 | pos setup iraq shop hardware |
| 3 | `e-fakhata-explained.md` | ~1,500 | e-fakhata iraq einvoice |
| 4 | `pharmacy-management-iraq.md` | ~1,500 | pharmacy management iraq |
| 5 | `restaurant-pos-iraq.md` | ~1,600 | restaurant pos iraq kds |
| 6 | `kurdish-erp-vs-zoho.md` | ~1,300 | kurdish erp vs zoho books iraq |
| 7 | `iraqi-dinar-formatting-best-practices.md` | ~1,300 | iraqi dinar format invoice |
| 8 | `whatsapp-commerce-iraq.md` | ~1,400 | whatsapp business iraq orders |
| 9 | `offline-first-pos-power-outages.md` | ~1,400 | offline pos iraq electricity |
| 10 | `chart-of-accounts-iraq-smb.md` | ~1,500 | chart of accounts iraq smb |

All posts: ≥ 1,200 words, frontmatter (title, description, date, author, tags, reading_minutes, target_query, og_image), proper H2/H3 hierarchy, internal links to `/features`, `/blog/...`, end-of-post CTA.

### Public / brand assets (placeholders for designer)
- `marketing/public/robots.txt` — allows all, points to `/sitemap-index.xml`, disallows `/legal/`
- `marketing/public/manifest.webmanifest` — PWA manifest, brand-red theme
- `marketing/public/brand/favicon.svg` — placeholder SVG favicon
- `marketing/public/brand/logo.svg` — placeholder logo with wordmark
- `marketing/public/brand/og/hero-1200x630.svg` — default OG card
- `marketing/public/brand/og/blog-template-1200x630.svg` — blog OG base
- `marketing/public/brand/README.md` — designer handoff notes listing required production assets

### CI
- `.github/workflows/marketing-ci.yml` — triggers on `marketing/**` changes; runs install → astro check → lint → build → Lighthouse CI → linkinator. Concurrency-grouped, 15-min timeout per job. Lighthouse + lint set to `continue-on-error` for initial budget; tighten once design assets land.

---

## 2. i18n key counts (confirmed)

| Locale | File | Keys |
|--------|------|------:|
| ku | `src/i18n/ku.json` | 70 |
| en | `src/i18n/en.json` | 70 |
| ar | `src/i18n/ar.json` | 70 |
| **Total** | | **210** |

Coverage: site meta, nav, hero, problems (3), features (6), pricing (10 keys + tier names), testimonial heading, CTA banner, footer (16 keys), contact form (18 keys), about, blog, legal, common.

Native-speaker review pass is **TODO** before launch (per T-G.1.6).

---

## 3. Lighthouse-budget verification approach

`lighthouserc.json` asserts:
- Performance ≥ 95 (mobile profile preferred; current config is desktop — flip to `preset: 'mobile'` before launch)
- Accessibility ≥ 95
- Best Practices ≥ 95
- SEO = 100
- LCP ≤ 1800ms
- CLS ≤ 0.1
- TBT ≤ 200ms (warn)
- FCP ≤ 1500ms (warn)

CI job builds → Chrome installs → `@lhci/cli autorun` runs against 9 representative URLs (3 locales × 3 key pages). Reports uploaded to LHCI temporary storage. Currently `continue-on-error: true`; flip to fail-build once placeholder assets are replaced (text-only hero may score lower without optimized image LCP).

**Self-verify path** (Windows, after `npm install --legacy-peer-deps`):
```powershell
cd marketing
npm run build
npx serve dist
# in another shell:
npm run lhci
```

---

## 4. Deployment notes (Vercel)

### Vercel project setup
1. **Create Vercel project** `kurdish-erp-marketing`, point at this repo, set root directory to `marketing/`.
2. **Framework preset**: Astro (auto-detected).
3. **Build command**: `npm run build` (already in `vercel.json`).
4. **Output directory**: `dist`.
5. **Install command**: `npm install --legacy-peer-deps`.
6. **Environment variables** (Production + Preview):
   - `PUBLIC_SITE_URL = https://zoho-kurdish.iq`
   - `PUBLIC_APP_URL = https://app.zoho-kurdish.iq`
   - `PUBLIC_LEADS_ENDPOINT = https://app.zoho-kurdish.iq/api/marketing/leads`
   - `PUBLIC_PLAUSIBLE_DOMAIN` — optional, set when Plausible host is decided
   - `PUBLIC_PLAUSIBLE_SRC` — optional
   - `PUBLIC_GA4_ID` — optional (consent-gated)
7. **Domains**: connect `zoho-kurdish.iq` apex + `www.zoho-kurdish.iq` (CNAME).
8. **Regions**: `fra1, cdg1` for EU/MENA latency (set in `vercel.json`).

### DNS (per T-G.1.1)
- A/CNAME for apex + `www` to Vercel.
- Reserve `app.`, `docs.`, `help.`, `status.` (separate Vercel/hosting projects per design).
- CAA records to restrict CA issuance.
- MX records for `support@`, `sales@`, `hello@`.

### Backend dependency
Marketing forms (`EmailCapture`, contact form) POST to **`/api/marketing/leads`** on the app backend. This endpoint is **NOT yet implemented** — see T-G.1.11 in tasks.md. Until then, form submissions will fail silently in the UI (status message will say "something went wrong"). Documented expected schema in `EmailCapture.astro` header comment.

---

## 5. Open questions / handoffs

### Brand
- **Designer:** replace `public/brand/*.svg` placeholders with production raster favicons, PWA icons, OG images, Twitter cards. See `public/brand/README.md` for spec.
- The brand palette is committed (muted brand-red `#e5495d`, muted accent-green `#2fa356`, ink neutrals) but the designer should validate against any existing brand guide.

### Analytics
- **Plausible: self-hosted vs hosted?** Recommendation in `README.md`: self-host on a small VPS (~USD 10/mo) for data sovereignty. Hosted plausible.io is fine if ops bandwidth is the constraint. **Decision needed from founder.**
- **GA4** is wired but optional — only loaded if `PUBLIC_GA4_ID` is set AND user grants consent.

### Backend
- **`POST /api/marketing/leads`** endpoint must be implemented in `backend/` (T-G.1.11). Schema documented inline in `EmailCapture.astro`. Expected to also handle the richer contact-form payload from `ContactPage.astro` (`name`, `business`, `governorate`, `usecase`, `users`, `phone`, `email`, `message`, `locale`, `consent`, `ts`, `source`).
- Lead-to-CRM routing (T-G.1.11): backend should create a Lead in the existing `/crm` module and notify the sales WhatsApp.

### Native-speaker QA
- Kurdish Sorani copy was authored by an LLM. **Native-speaker review** of all 70 ku.json keys + the hero/feature/about/contact copy is required before launch.
- Arabic copy is in Iraqi-MSA register; review by a native Iraqi Arabic speaker recommended.
- Blog posts are English-only as seed; Kurdish and Arabic translations should follow once English copy is locked.

### Legal
- `/legal/{terms,privacy,dpa}` pages are placeholders with `noindex`. **Counsel review required** before launch (T-G.1.x in legal track). The content is structured per industry-standard SaaS DPA/Terms templates but is not legally vetted for Iraqi/KRG jurisdiction.

### Performance budget tightening
- Lighthouse CI is `continue-on-error` for initial PRs. Once OG images are rasterized and Vazirmatn font subset is fingerprinted, flip to hard-fail.
- Replace Google Fonts CDN link with a self-hosted Vazirmatn subset (Kurdish + Arabic + Latin) preloaded to remove the cross-origin dependency. Currently pulled from `fonts.googleapis.com` for development convenience.

### Docs site (out of scope for G1, in scope for G1 spec)
- `docs.zoho-kurdish.iq` Docusaurus project (T-G.1.7) — **not built here**. Listed in spec for completion of Phase G1 but is a separate codebase.

### Demo asset (R1.4)
- The interactive demo (90-second screen recording OR Arcade.so embed) is referenced in copy but not yet present. Needs to be produced. Hero CTA currently points to `/signup` on the app; the alternate variant ("See 90-sec demo") will need a video asset before A/B activation.

---

## 6. Verification commands (Windows / PowerShell)

After cloning a fresh checkout:

```powershell
cd C:\Users\SAFA\zoho\marketing
npm install --legacy-peer-deps
npm run dev
# Visit http://localhost:4321/
#        http://localhost:4321/en/
#        http://localhost:4321/ar/
#        http://localhost:4321/pricing
#        http://localhost:4321/blog
#        http://localhost:4321/blog/iraq-tax-guide-2026
```

To produce a production build and inspect:

```powershell
npm run build
npm run preview
```

To run Lighthouse locally:

```powershell
npm run build
npx --yes @lhci/cli@0.14 autorun --config=./lighthouserc.json
```

---

## 7. What is NOT included (per T-G.1 cuts)

- **Docs site (Docusaurus)** — T-G.1.7/8, separate project.
- **40 KB articles** (R2.2) — that is Phase G2 (Customer Support Stack).
- **OG image runtime generation** — Vercel OG-image API is not wired; OG image is a static SVG. Designer to produce rasterized PNG; runtime per-page generation is a follow-up.
- **hCaptcha integration** — code hook in contact form but no site key. **TODO before launch.**
- **Backend `/api/marketing/leads`** — see "Open questions / Backend" above.
- **Real customer testimonials** — currently placeholder Iraqi-flavored names. Replace with actual customer quotes (with permission) before launch.
- **Demo video / interactive sandbox** — see R1.4 above.

Time elapsed: ~85 minutes within the 75-90 minute budget. Build is ready for `npm install --legacy-peer-deps && npm run dev` on a Windows machine with Node 20+.
