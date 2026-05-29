# Tasks Document: Growth to 100 — From First Paying Customer to 100 Paying Customers

> **Spec ID:** `growth-to-100`
> **Status:** Draft v1.0
> **Owner:** Safa Othman
> **Total scope:** ~6 months elapsed, including 4 weeks of mobile review wait time, with 1.5–2 engineers + 1 part-time content writer + occasional native-language QA.

---

## Phase Overview

| Phase | Theme | Duration | Engineers | Calendar weeks |
|-------|-------|---------:|----------:|---------------:|
| **G1** | Marketing site launch | 4 weeks | 1.5 | W1–W4 |
| **G2** | Customer support stack | 3 weeks | 1.5 | W3–W5 (overlap) |
| **G3** | Hardware lab + compatibility | 4 weeks | 1 (eng) + procurement | W4–W7 |
| **G4** | Iraq compliance deep dive | 6 weeks | 2 | W6–W11 |
| **G5** | Mobile distribution | 4 weeks build + 4 weeks review wait | 1 | W8–W15 |
| **Cross-cutting** | Translation, docs, partner outreach | continuous | shared | W1–W24 |

Phases overlap deliberately so the team is never blocked on a single track.

Task IDs follow `T-G.X.Y` format where X is the phase number and Y is the sequence inside the phase.

---

## Phase G1 — Marketing Site Launch (4 weeks)

### T-G.1.1 — Procure domains and configure DNS
**Effort:** 0.5 day. **Owner:** Founder.
- Verify ownership of `zoho-kurdish.iq` apex and the `app`, `docs`, `help`, `status` subdomains.
- Configure DNS at the registrar: CNAMEs for `www`, `app`, `docs`, `help`, `status` pointing at the respective providers.
- Set up CAA records to restrict CA issuance.
- Set up MX records for `support@`, `sales@`, `hello@`.

### T-G.1.2 — Scaffold marketing repo
**Effort:** 1 day. **Owner:** Eng A.
- Create `marketing/` workspace inside the monorepo (or a sibling repo, decision documented).
- Astro 4 + Tailwind + MDX + `@astrojs/sitemap` + `@astrojs/image`.
- Set up `@zoho-kurdish/tokens` workspace package and import in marketing Tailwind config.
- ESLint + Prettier + tsconfig aligned with app.
- README with run instructions.

### T-G.1.3 — Build the layout shell (header, footer, locale switcher)
**Effort:** 2 days. **Owner:** Eng A.
- Three-locale routing: `/`, `/ar/`, `/en/`. Default is Kurdish.
- Header: logo, primary nav (Product, Pricing, Docs, Blog, Customers), locale switcher, login link to app, primary CTA.
- Footer: secondary nav, contact, social links, language switcher, newsletter capture.
- Mobile menu drawer.
- RTL CSS using logical properties.

### T-G.1.4 — Build the homepage hero
**Effort:** 2 days. **Owner:** Eng A + content.
- Above-the-fold spec from R1.2: headline, sub-headlines, primary CTA, hero visual, credibility row.
- Below the fold: 3-pillar feature row, customer logos placeholder, testimonial placeholder, second CTA.
- LCP target ≤ 1.5s on mid-tier Android.
- A/B variant infrastructure scaffolded.

### T-G.1.5 — Build the pricing page
**Effort:** 2 days. **Owner:** Eng A + content.
- Three-tier cards with monthly/annual toggle (R1.3).
- Per-tier feature lists, upgrade reason callout, CTA.
- Detailed feature-comparison table below.
- FAQ section underneath.
- IQD as primary currency, USD secondary.

### T-G.1.6 — Author and translate Starter / Growth / Pro feature copy
**Effort:** 2 days. **Owner:** Content + Founder.
- Three-tier feature decomposition aligned with the application's module licensing.
- Translate to Arabic and English.
- Native-speaker review pass.

### T-G.1.7 — Build the docs site
**Effort:** 3 days. **Owner:** Eng A.
- Docusaurus 3 with i18n (Kurdish, Arabic, English).
- Section structure per R1.6.
- Algolia DocSearch application submitted; until approved, use a local Meilisearch fallback.
- Deploy to a separate Vercel project at `docs.zoho-kurdish.iq`.

### T-G.1.8 — Seed docs with 20 starter articles
**Effort:** 4 days. **Owner:** Content + Eng A.
- Cover the Getting Started, POS Setup, Invoicing, e-Fakhata, Hardware sections at minimum.
- Each article: H1, intro, screenshots, step-by-step, related links.

### T-G.1.9 — Write 10 SEO blog posts (R1.5)
**Effort:** 10 days (1 day per post). **Owner:** Content + Founder.
- Outlines per design §1.5.
- Each post is 1,500–2,500 words; bilingual writer drafts in Kurdish and Arabic in parallel; English translation review.
- Cover image, OG image, JSON-LD `Article`, breadcrumb.

### T-G.1.10 — Build the contact / talk-to-sales form
**Effort:** 1 day. **Owner:** Eng A.
- Fields per R1.7.
- Spam protection: hCaptcha invisible mode.
- POST to `/api/leads` on the application backend (new endpoint, T-G.1.11).
- On success: thank-you page + email confirmation + WhatsApp prefilled link.

### T-G.1.11 — Backend `/api/leads` endpoint
**Effort:** 1 day. **Owner:** Eng B.
- FastAPI route under `backend/routers/leads.py`.
- Validates payload; creates a Lead record in `/crm`; emits notification to `sales@` and the WhatsApp channel; returns 202.
- Rate-limited per IP (slowapi).

### T-G.1.12 — Newsletter capture with double opt-in
**Effort:** 1 day. **Owner:** Eng A + Eng B.
- Footer + in-content form posting to `/api/newsletter/subscribe`.
- Backend stores pending subscriber and emails a confirmation link.
- Confirmation link click writes `confirmed_at`.
- Unsubscribe link emits a confirmation page.

### T-G.1.13 — A/B testing edge middleware
**Effort:** 2 days. **Owner:** Eng A.
- Vercel Edge middleware reads/writes `_abc` cookie, assigns variant via deterministic hash.
- Variant exposed via response header consumed by Astro components.
- Exposure event POSTed to `/api/rum/marketing` and Plausible custom event.
- Initial three experiments wired (per design §1.6).

### T-G.1.14 — Analytics: Plausible self-hosted + GA4
**Effort:** 2 days. **Owner:** Eng A.
- Self-host Plausible on a small VPS (5 USD/month tier acceptable).
- Drop GA4 tracking script behind cookie consent.
- Wire events per design §1.7.

### T-G.1.15 — Cookie consent banner
**Effort:** 1 day. **Owner:** Eng A.
- Lightweight implementation: `cookie-consent-js` or custom 8 KB script.
- Gated on EU/EEA geolocation (Vercel Edge geolocation API).
- Stores consent in a cookie; gates GA4 load on consent.

### T-G.1.16 — Open Graph image generation
**Effort:** 1 day. **Owner:** Eng A.
- Vercel OG image API endpoint that renders a brand template with the page title.
- Build-time call per page; output served from `public/og-images/`.

### T-G.1.17 — Sitemap, robots, structured data
**Effort:** 1 day. **Owner:** Eng A.
- `@astrojs/sitemap` for sitemap.
- robots.txt with sitemap directive.
- Page-level JSON-LD: Organization, Product, FAQPage, Article, BreadcrumbList.

### T-G.1.18 — Lighthouse CI gate
**Effort:** 1 day. **Owner:** Eng A.
- LHCI configured per spec NFR-G2 / R1.12 (Perf ≥ 95, A11y ≥ 95, BP ≥ 95, SEO = 100).
- Fail PR on regression > 3 points.

### T-G.1.19 — Marketing site go-live checklist + Search Console submission
**Effort:** 0.5 day. **Owner:** Founder.
- Verify ownership in Google Search Console + Bing Webmaster Tools.
- Submit sitemap to both.
- Set up uptime monitoring (Better Stack free tier or Uptimerobot).

### T-G.1.20 — Demo video production
**Effort:** 3 days. **Owner:** Founder + content.
- Script in Kurdish (3 min).
- Screen recording with annotated overlays.
- Arabic and English subtitles.
- Host on YouTube (unlisted) AND on the marketing site via a self-hosted MP4 fallback.

---

## Phase G2 — Customer Support Stack (3 weeks)

### T-G.2.1 — Set up Crisp account and embed
**Effort:** 1 day. **Owner:** Founder + Eng B.
- Crisp Pro account (USD 25/month).
- Embed snippet in the application (deferred-load) and on the help portal.
- Configure trilingual operator hours and an out-of-hours auto-reply.

### T-G.2.2 — Stand up help portal
**Effort:** 3 days. **Owner:** Eng A.
- Either a Crisp-hosted KB OR a custom Astro page that consumes Notion-published articles.
- URL: `help.zoho-kurdish.iq`.
- Trilingual search.
- Visible link to Crisp chat, WhatsApp, email.

### T-G.2.3 — Author 40 KB articles in three languages
**Effort:** 10 days. **Owner:** Content + Founder.
- Coverage per R2.2 (5 + 6 + 8 + 5 + 4 + 3 + 4 + 3 + 2 = 40).
- Each article in Kurdish (primary), Arabic, English.
- Annotated screenshots from real product.
- "Was this helpful?" feedback wired to a Crisp custom property OR a `kb_feedback` collection.

### T-G.2.4 — Implement impersonation backend
**Effort:** 3 days. **Owner:** Eng B.
- `POST /api/admin/impersonate` (super-admin only) — issues 30-min read-only JWT with actor claim.
- Middleware enforces read-only on impersonation token.
- `impersonation_audit` collection with append-only writes.
- `impersonation_audit_events` subcollection logging every request.
- `POST /api/admin/impersonate/end`.

### T-G.2.5 — Implement impersonation frontend banner + guards
**Effort:** 2 days. **Owner:** Eng A.
- Top banner per design §2.3 — visible across all routes; live countdown; "Stop impersonation" button.
- Auth context detects `impersonation: true` and disables mutation handlers.
- "Stop impersonation" button POSTs end endpoint and clears session token.

### T-G.2.6 — Per-tenant feature flag override
**Effort:** 2 days. **Owner:** Eng B.
- Backend `GET/PUT /api/admin/feature-flags/tenant/{tenant_id}`.
- Frontend `useFeatureFlag` resolves tenant overrides on top of global flags.
- Audit log on every override change.
- Slack/WhatsApp webhook on change.

### T-G.2.7 — Stand up status page on Statuspage.io
**Effort:** 1 day. **Owner:** Founder.
- Statuspage.io account (USD 29/month).
- Configure components per design §2.4.
- Custom subdomain `status.zoho-kurdish.iq`.
- Subscribe team email and a public RSS feed.

### T-G.2.8 — Synthetic probes for status page
**Effort:** 2 days. **Owner:** Eng B.
- Cloud Function runs every 60s.
- Probes: API health, POS sync write+read, e-fakhata sandbox submission, daily WhatsApp test.
- Pushes results to Statuspage API.

### T-G.2.9 — In-app help widget
**Effort:** 2 days. **Owner:** Eng A.
- `frontend/src/components/help/HelpWidget.tsx`.
- Floating button (RTL-aware).
- Drawer with contextual KB, search, Contact, WhatsApp, status banner.
- Defers Crisp SDK load until first interaction.

### T-G.2.10 — Email routing for `support@zoho-kurdish.iq`
**Effort:** 0.5 day. **Owner:** Founder.
- Configure Google Workspace / Zoho Mail shared inbox.
- Forwarding rule into Crisp inbox.
- Auto-reply for first contact with localized text.

### T-G.2.11 — WhatsApp Business integration via 360Dialog
**Effort:** 4 days. **Owner:** Eng B + Founder.
- 360Dialog account onboarding (1–2 weeks calendar wait — start early).
- WhatsApp Business profile setup with Iraqi country code.
- Webhook `/api/whatsapp/inbound` creates tickets in Crisp.
- Outbound: Crisp webhook → `/api/whatsapp/outbound` → 360Dialog.
- Opt-in handling.

### T-G.2.12 — Saved replies (30 × 3 = 90 entries)
**Effort:** 2 days. **Owner:** Content + Founder.
- Author 30 saved-reply texts per design §2.7.
- Translate to Kurdish, Arabic, English.
- Load into Crisp saved-replies feature.

### T-G.2.13 — Onboarding drip sequence
**Effort:** 3 days. **Owner:** Eng B + Content.
- `onboarding_track` collection scaffold.
- APScheduler jobs for day 0, 1, 3, 7, 10, 14.
- Templated email + WhatsApp messages per locale.
- Milestone detection for personalized branches.

### T-G.2.14 — NPS in-app modal
**Effort:** 2 days. **Owner:** Eng A.
- Modal shown once per user at day 30, 90, 180.
- 0–10 score + free-text comment.
- Stored in `nps_responses`.
- Dashboard widget for founder.

### T-G.2.15 — Support SLA tracking dashboard
**Effort:** 2 days. **Owner:** Eng A.
- Pull MTTA / MTTR from Crisp API.
- Aggregate per tier; surface breaches.
- Founder dashboard widget.

---

## Phase G3 — Hardware Lab + Compatibility (4 weeks)

### T-G.3.1 — Procure printer lab
**Effort:** 1 week elapsed (procurement, shipping). **Owner:** Founder.
- Order Epson TM-T20III (USB + Ethernet), Xprinter XP-T80A (USB + BT), Bixolon SRP-330II (USB + serial), generic BT 58mm (Goojprt or similar), placeholder for 2026 newest entrant.
- Order 3 barcode scanners: HID USB (Honeywell/Symbol/Zebra entry), BT HID, camera-only fallback target devices already on hand.
- Order 2 cash drawers: 6-pin Epson-pinout, 4-pin alternate.
- Order 2 customer-display options: LCD pole, 8" tablet for PWA path.
- Budget: ~USD 1,500.

### T-G.3.2 — Stand up hardware lab and inventory tracking
**Effort:** 1 day. **Owner:** Eng A.
- Catalog each device with photo, model, serial, firmware as bought.
- Tracking spreadsheet (Notion or Sheets) with checkout log.

### T-G.3.3 — Design `IPrinterProfile` interface
**Effort:** 1 day. **Owner:** Eng A.
- Per design §3.1.
- TypeScript interface + reference implementation for Epson.

### T-G.3.4 — Implement Epson profile + byte-stream test
**Effort:** 2 days. **Owner:** Eng A.
- All ESC/POS commands for Epson per profile.
- Capture real byte streams from device into a fixture.
- Vitest test asserting generator output matches fixture.

### T-G.3.5 — Implement Xprinter profile + byte-stream test
**Effort:** 2 days. **Owner:** Eng A.

### T-G.3.6 — Implement Bixolon profile + byte-stream test
**Effort:** 2 days. **Owner:** Eng A.

### T-G.3.7 — Implement generic BT 58mm profile + byte-stream test
**Effort:** 2 days. **Owner:** Eng A.

### T-G.3.8 — Implement dialect detection probe + fallback
**Effort:** 2 days. **Owner:** Eng A.
- Probe sequence per design §3.3.
- Unit tests covering each known response.
- Fallback to generic profile.

### T-G.3.9 — Transport layer: USB, Bluetooth, network
**Effort:** 3 days. **Owner:** Eng A.
- `UsbTransport` via WebUSB on supported platforms; Capacitor plugin on mobile.
- `BluetoothTransport` via Web Bluetooth on desktop; Capacitor BLE on mobile.
- `NetworkTransport` via raw socket through Cap plugin.

### T-G.3.10 — Hardware pairing wizard UI
**Effort:** 4 days. **Owner:** Eng A.
- 7-step wizard per design §3.7.
- Localized strings (Kurdish, Arabic, English).
- Illustrations per step.
- Persists active profile in IndexedDB.

### T-G.3.11 — Test print + verify cut flow
**Effort:** 1 day. **Owner:** Eng A.
- Test receipt template covering: Arabic, Kurdish, Latin text, barcode, QR, logo.
- "Did it cut cleanly?" prompt linked to troubleshooting.

### T-G.3.12 — Cash drawer kick matrix
**Effort:** 1 day. **Owner:** Eng A.
- Pin-5 and pin-2 sequences per profile.
- Wizard offers pin-5 first, falls back to pin-2.

### T-G.3.13 — HID barcode scanner integration
**Effort:** 2 days. **Owner:** Eng A.
- Global keypress listener with barcode-mode timer.
- Dispatches decoded value to active POS context.

### T-G.3.14 — Camera barcode fallback in Web Worker
**Effort:** 3 days. **Owner:** Eng A.
- `@zxing/browser` running in a worker.
- Symbology set per requirement.
- Acceptable accuracy on top-12 Iraqi devices.

### T-G.3.15 — Customer display: LCD pole
**Effort:** 3 days. **Owner:** Eng A.
- Serial protocol implementation for one common LCD pole model.
- Renders last line + total.

### T-G.3.16 — Customer display: tablet/TV PWA
**Effort:** 3 days. **Owner:** Eng A.
- Route `display.zoho-kurdish.iq/{terminal_id}`.
- Firestore subscription to `pos_display_state/{terminal_id}`.
- Full-screen card UI.

### T-G.3.17 — Receipt template 58mm
**Effort:** 2 days. **Owner:** Eng A.
- Tighter line width.
- Same IQD denomination breakdown.
- Tested across all four primary printers.

### T-G.3.18 — Publish compatibility matrix
**Effort:** 1 day. **Owner:** Eng A + Content.
- Markdown document under `docs.zoho-kurdish.iq/hardware`.
- One row per device with status, firmware, dialect, known limits, test-print PDF link.

### T-G.3.19 — Vendor partnership outreach
**Effort:** 2 weeks elapsed. **Owner:** Founder.
- Identify 3 Iraqi retail-hardware distributors.
- Pitch shopkeeper kit bundle.
- Sign 1 partner before phase ends.

### T-G.3.20 — Quarterly hardware regression test setup
**Effort:** 1 day. **Owner:** Eng A.
- Define a regression checklist.
- Schedule the first quarterly run.

---

## Phase G4 — Iraq Compliance Deep Dive (6 weeks)

### T-G.4.1 — MoF e-fakhata spec procurement
**Effort:** 2 days. **Owner:** Founder.
- Obtain current MoF e-fakhata XSD and submission spec (formal channel via MoF).
- Translate any Arabic-only sections.
- Track spec version in `backend/efakhata/schemas/`.

### T-G.4.2 — XSD v2 implementation
**Effort:** 3 days. **Owner:** Eng B.
- Implement `backend/efakhata/schemas/v2.xsd`.
- Document version selection per tenant.

### T-G.4.3 — XML generator from `Invoice` model
**Effort:** 3 days. **Owner:** Eng B.
- Map invoice + lines + tax breakdown to v2 XML.
- Cover edge cases: WHT line, customs fields, multi-currency.

### T-G.4.4 — XML validation against XSD
**Effort:** 1 day. **Owner:** Eng B.
- Unit tests over a corpus of sample invoices.

### T-G.4.5 — Per-tenant PKCS#12 keystore management
**Effort:** 2 days. **Owner:** Eng B.
- Secret Manager storage layer keyed by tenant.
- Admin UI for uploading/rotating tenant keystore.
- Audit on every read.

### T-G.4.6 — XAdES-BES signing implementation
**Effort:** 3 days. **Owner:** Eng B.
- Canonicalize, hash, sign, embed.
- Verification round-trip test.

### T-G.4.7 — MoF submission client
**Effort:** 3 days. **Owner:** Eng B.
- `mof_client` module: auth, submission, polling, retry, error mapping.
- Configurable sandbox vs production URL per tenant.

### T-G.4.8 — Submission queue + worker
**Effort:** 2 days. **Owner:** Eng B.
- Queue: Pub/Sub or Firestore-backed.
- Worker: Cloud Run service with concurrency 1 per tenant.
- 5-attempt retry with exponential back-off.

### T-G.4.9 — Submission state UI on invoice detail page
**Effort:** 2 days. **Owner:** Eng A.
- Badge: pending / submitted / accepted / rejected / error.
- "Resubmit" action.
- Localized error explanation.

### T-G.4.10 — Tenant onboarding wizard for e-fakhata
**Effort:** 2 days. **Owner:** Eng A + Eng B.
- Steps: declare VAT status, upload PKCS#12 (or import from MoF if API supports), enable submission flag, send a test submission.

### T-G.4.11 — VAT vs non-VAT tenant declaration
**Effort:** 1 day. **Owner:** Eng B.
- Company profile fields: `vat_registered`, `vat_registration_number`, `tin`, `crn`.
- Format validation per design §4.x.

### T-G.4.12 — Invoice template variants
**Effort:** 2 days. **Owner:** Eng A.
- VAT-registered template includes VAT lines + TIN.
- Non-VAT template includes disclaimer and excludes VAT/TIN.

### T-G.4.13 — WHT rules registry + accounts
**Effort:** 2 days. **Owner:** Eng B.
- `wht_rules` collection + admin UI.
- New COA accounts `wht_payable`, `wht_receivable`.
- Default rules seeded per Iraq norms.

### T-G.4.14 — WHT line calculation on invoices
**Effort:** 2 days. **Owner:** Eng A + Eng B.
- Auto-add WHT line based on line categorization.
- Net payable computation.
- Journal entries on payment include WHT split.

### T-G.4.15 — Annual income-tax flat-rate report
**Effort:** 2 days. **Owner:** Eng B.
- Tenant declares regime.
- Reports module produces annual income-tax summary.

### T-G.4.16 — Arabic-Indic digit render utility
**Effort:** 1 day. **Owner:** Eng A.
- `formatDigits` utility + tenant setting `digits` toggle.
- Apply across invoice, receipt, dashboard, reports, PDF, page numbers.

### T-G.4.17 — IQD currency formatter
**Effort:** 1 day. **Owner:** Eng A.
- `formatIQD` utility per design §4.6.
- RTL positioning.
- Apply across UI and PDF.

### T-G.4.18 — IQD denomination cash-drawer reconciliation UI
**Effort:** 2 days. **Owner:** Eng A.
- Table with rows for 250, 500, 1000, 5000, 10000, 25000, 50000.
- Withdrawn denomination tag.
- Live total.

### T-G.4.19 — Hijri date utility + tenant toggle
**Effort:** 1 day. **Owner:** Eng A.
- `formatHijri` utility.
- Setting `display_hijri`.
- Apply to invoice + receipt headers.

### T-G.4.20 — Arabic PDF typesetting
**Effort:** 3 days. **Owner:** Eng B.
- Bundle Noto Naskh Arabic + Amiri.
- WeasyPrint or pdfkit with proper shaping.
- Visual regression test against reference PNG.

### T-G.4.21 — Customs invoice variant
**Effort:** 2 days. **Owner:** Eng A + Eng B.
- Extra fields per line: HS code, country of origin, port.
- PDF template `CustomsInvoice.tsx`.
- XML export (when customs API integration is enabled).

### T-G.4.22 — CBI exchange-rate daily fetcher
**Effort:** 2 days. **Owner:** Eng B.
- Cloud Scheduler at 09:00 Baghdad.
- Cloud Function fetches and parses.
- Stores in `exchange_rates/{YYYY-MM-DD}`.
- Fallback to previous day on failure with alert.

### T-G.4.23 — Multi-currency snapshot at issue
**Effort:** 1 day. **Owner:** Eng B.
- Invoice records `exchange_rate_at_issue`.
- Reports honor historical rate.

### T-G.4.24 — Tax-rules registry with effective dates
**Effort:** 1 day. **Owner:** Eng B.
- `taxRulesRegistry.ts` + backend mirror.
- Rule changes append new versioned entries.

### T-G.4.25 — Tax auditor export ZIP
**Effort:** 2 days. **Owner:** Eng B.
- Bundle signed XMLs, PDFs, CSVs for a date range.
- Cover sheet with tenant info.
- Admin-only download + audit log.

### T-G.4.26 — Compliance native-speaker QA pass
**Effort:** 3 days. **Owner:** Native Arabic/Kurdish accountant.
- Review all tax-related strings in Kurdish and Arabic.
- Sign-off checklist before release.

### T-G.4.27 — Sandbox round-trip with MoF
**Effort:** 3 days elapsed. **Owner:** Founder + Eng B.
- Submit at least 50 test invoices through MoF sandbox.
- Document each error class and the localized message we surface.

### T-G.4.28 — Pilot with one paying tenant in production
**Effort:** 2 weeks elapsed (calendar). **Owner:** Founder.
- Onboard one VAT-registered tenant to submit live e-fakhata.
- Monitor for 2 weeks.
- Confirm no rejections that block the tenant's operations.

### T-G.4.29 — Penalty & retention policy documentation
**Effort:** 1 day. **Owner:** Content.
- Document MoF penalties for non-submission.
- Document our retention policy (signed XML retention period).
- Publish to marketing site / docs.

### T-G.4.30 — Compliance dashboard for founder
**Effort:** 2 days. **Owner:** Eng A.
- Per-tenant submission state, error rates, rejection codes.
- Alerts on systemic rejections.

---

## Phase G5 — Mobile Distribution (4 weeks build + 4 weeks review wait)

### T-G.5.1 — Google Play Console enrollment
**Effort:** 2 days elapsed. **Owner:** Founder.
- Account setup, identity verification, payment.

### T-G.5.2 — Apple Developer Program enrollment
**Effort:** 1–3 weeks elapsed (uncertain). **Owner:** Founder.
- Attempt Iraqi entity first.
- If rejected, pivot to partner entity in Turkey or Jordan with rights-assignment agreement.

### T-G.5.3 — Android keystore generation + storage
**Effort:** 0.5 day. **Owner:** Eng B.
- Generate upload keystore.
- Store base64-encoded in GitHub Actions secret.
- Document recovery via Google Play App Signing.

### T-G.5.4 — iOS Fastlane Match setup
**Effort:** 1 day. **Owner:** Eng B.
- Private GitHub repo for certificates.
- Passphrase in 1Password.
- Documented onboarding flow.

### T-G.5.5 — Capacitor release pipeline (Android)
**Effort:** 2 days. **Owner:** Eng B.
- `release-android.yml`: build AAB on tagged release, upload to Play Internal track via Fastlane Supply.

### T-G.5.6 — Capacitor release pipeline (iOS)
**Effort:** 2 days. **Owner:** Eng B.
- `release-ios.yml`: macOS runner, build IPA, upload to TestFlight via Fastlane Pilot.

### T-G.5.7 — App icons + splash screens
**Effort:** 3 days. **Owner:** Designer (contract) + Eng A.
- Design app icon with Iraqi color nod + Kurdish text.
- Export at all required Android mipmaps and iOS Contents.json sizes.
- Maskable variant for Android adaptive icons.
- Splash screens with logo + localized "Loading…".

### T-G.5.8 — Play Store listing (trilingual)
**Effort:** 3 days. **Owner:** Founder + Content.
- Title, short, full description in Kurdish, Arabic, English.
- Real-device screenshots at required resolutions.
- Feature graphic 1024×500.
- Content rating questionnaire.
- Privacy policy URL.

### T-G.5.9 — App Store listing (trilingual)
**Effort:** 3 days. **Owner:** Founder + Content.
- Title, subtitle, keywords, description, promotional text per locale.
- Screenshots at all required iPhone / iPad sizes.
- 15–30s app preview video.
- Privacy nutrition labels.

### T-G.5.10 — FCM integration
**Effort:** 3 days. **Owner:** Eng B.
- Capacitor FCM plugin wired.
- Permission request flow on first launch.
- Token registration via `/api/push/register`.
- Token refresh handling.

### T-G.5.11 — APNs integration
**Effort:** 3 days. **Owner:** Eng B.
- Capacitor push plugin for iOS.
- Provisioning includes push capability.
- Token registration unified with FCM.

### T-G.5.12 — Backend push dispatch service
**Effort:** 3 days. **Owner:** Eng B.
- `/api/push/send` dispatch.
- Topic management.
- Delivery success tracking.

### T-G.5.13 — In-app update gate
**Effort:** 2 days. **Owner:** Eng A.
- `UpdateGate.tsx` per design §5.5.
- `/api/app/version-info` endpoint.
- Localized messages.

### T-G.5.14 — `mobile_versions` admin UI
**Effort:** 1 day. **Owner:** Eng A.
- Super-admin can toggle `force_update`.
- Audit log.

### T-G.5.15 — Crashlytics integration
**Effort:** 1 day. **Owner:** Eng B.
- Firebase Crashlytics plugin.
- Symbols upload on release.
- Weekly review process documented.

### T-G.5.16 — Firebase Test Lab pre-launch report
**Effort:** 2 days. **Owner:** Eng B.
- Configured in `release-android.yml`.
- Device pool per design §5.6.
- Fail release promotion on regressions.

### T-G.5.17 — Beta testing program setup
**Effort:** 1 day. **Owner:** Founder.
- Play Internal Testing track with 10+ testers.
- TestFlight group with 10+ testers.
- Feedback channel (private Discord or WhatsApp group).

### T-G.5.18 — ASO research + keyword backlog
**Effort:** 2 days. **Owner:** Content + Founder.
- AppFollow free tier signup.
- Keyword research per locale.
- Quarterly refresh schedule.

### T-G.5.19 — Marketing site mobile download CTAs
**Effort:** 0.5 day. **Owner:** Eng A.
- Play + App Store badges on landing, pricing footer, Download page.
- UTM-tagged URLs.

### T-G.5.20 — Sanctions + push-fallback documentation
**Effort:** 1 day. **Owner:** Eng B + Founder.
- Document Apple enrollment fallback procedure.
- Document push delivery fallback strategy.

### T-G.5.21 — Production release: Android
**Effort:** 1 day build + 3 days review wait. **Owner:** Eng B.

### T-G.5.22 — Production release: iOS
**Effort:** 1 day build + 7–14 days review wait. **Owner:** Eng B.

### T-G.5.23 — Post-release crash rate monitoring (first 14 days)
**Effort:** continuous. **Owner:** Eng B.
- Daily Crashlytics review.
- Hotfix release if < 99.5%.

### T-G.5.24 — Push delivery success monitoring
**Effort:** continuous. **Owner:** Eng B.
- Per-tenant delivery success metric.
- Alert at < 80%.
- Trigger in-app WebSocket fallback at tenant level.

### T-G.5.25 — Mobile launch retrospective
**Effort:** 0.5 day. **Owner:** Team.
- Document what worked, what didn't, what changes for next release.

---

## Cross-cutting

### T-G.X.1 — Translation pipeline for marketing + support
**Effort:** continuous. **Owner:** Content.
- All new marketing copy gets Kurdish + Arabic + English review.
- Native-speaker QA before launch of any compliance feature.

### T-G.X.2 — Documentation continuous publishing
**Effort:** continuous. **Owner:** Content.
- Each shipped feature gets a docs page within 5 business days of release.

### T-G.X.3 — Partner outreach (hardware + payment)
**Effort:** continuous. **Owner:** Founder.
- 1 hardware partner (G3).
- Defer payment-rail partnerships to post-100.

### T-G.X.4 — Press + community outreach
**Effort:** continuous. **Owner:** Founder.
- Reach out to Iraqi tech press, KRG business community channels, Iraqi-developer Twitter/X.
- Aim for 3 mentions before public launch.

### T-G.X.5 — Founder customer interviews
**Effort:** 4 hours/week. **Owner:** Founder.
- Talk to every signed-up tenant in the first 30 days.
- Capture verbatim feedback into a `customer_voice` notebook.

---

## Risk Register (15 entries)

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|------|:----------:|:------:|------------|-------|
| R-G-01 | MoF e-fakhata spec changes mid-implementation | High | High | Version XSDs; design `mof_client` for spec swap; track MoF change log weekly | Eng B |
| R-G-02 | MoF API access denied or delayed for our tenants | Medium | Critical | Sandbox-only path for non-mandated tenants; document the manual fallback (export signed XML to file, customer hand-uploads to MoF portal) | Founder |
| R-G-03 | Apple Developer Program rejects Iraqi entity | High | High | Pre-arrange Turkey/Jordan partner entity with rights assignment | Founder |
| R-G-04 | FCM degraded in some Iraqi networks (sanctions / blocks) | Medium | Medium | Per-tenant WebSocket long-poll fallback; in-app banner when push undeliverable | Eng B |
| R-G-05 | Hardware unavailable / import-restricted in Iraq | Medium | High | Build relationships with 2 hardware distributors; document import via KRG channel | Founder |
| R-G-06 | App Store rejection on first submission (Capacitor, content) | High | Medium | Pre-flight checklist; first submission as a beta promotion; 2 review cycles budgeted | Eng B |
| R-G-07 | KB articles drift from product as UI evolves | High | Medium | Automated screenshot regeneration script; quarterly KB audit | Content |
| R-G-08 | Translation quality issues damage credibility | Medium | High | Native-speaker review gate before every compliance release; user feedback channel for translation issues | Content |
| R-G-09 | Statuspage.io costs scale faster than expected | Low | Low | Cachet self-host migration path documented | Eng B |
| R-G-10 | 360Dialog onboarding delays WhatsApp launch | Medium | Medium | Start onboarding 8 weeks before launch; Twilio fallback warm | Founder |
| R-G-11 | Hardware lab unavailable to remote engineers | Medium | Medium | Recorded byte-stream fixtures suffice for code changes; physical tests scheduled monthly | Eng A |
| R-G-12 | Pricing tiers misaligned with customer willingness-to-pay | High | High | Monthly cohort analysis; willingness to A/B test pricing | Founder |
| R-G-13 | Impersonation feature misused or breached | Low | Critical | Read-only enforcement at backend; audit log retention; quarterly security review | Eng B |
| R-G-14 | CBI rate fetch breaks if CBI changes their published format | Medium | Medium | Resilient parsing + previous-day fallback + alert + manual override UI | Eng B |
| R-G-15 | Founder bandwidth exhausted in support and sales simultaneously | High | High | Hire support agent at 25 paying customers; codify saved replies; onboarding drip to deflect | Founder |

---

## Success Metrics

| Metric | Target at 30 days post-launch | Target at 100 customers |
|--------|------------------------------:|------------------------:|
| Marketing site monthly unique visitors | ≥ 1,000 | ≥ 8,000 |
| Marketing site signup conversion | ≥ 2% | ≥ 4% |
| Activation rate (signup → first invoice) | ≥ 30% | ≥ 50% |
| Trial-to-paid conversion | ≥ 10% | ≥ 20% |
| Time to first value (median days) | ≤ 5 | ≤ 2 |
| Support tickets per paying customer per month | ≤ 4 | ≤ 1.5 |
| Support first-response SLA compliance | ≥ 90% | ≥ 95% |
| KB self-serve deflection rate | ≥ 20% | ≥ 40% |
| Status page uptime visible | 99.9% | 99.95% |
| Mobile crash-free rate | ≥ 99.0% | ≥ 99.5% |
| Mobile install rate from marketing site | ≥ 5% | ≥ 8% |
| e-Fakhata submission success rate | ≥ 95% | ≥ 99% |
| Hardware pairing first-try success | ≥ 70% | ≥ 90% |
| NPS at day 30 | ≥ +20 | ≥ +40 |
| Logo churn (paying) | ≤ 5%/month | ≤ 2%/month |
| Net Revenue Retention | ≥ 90% | ≥ 110% |

These metrics are tracked in the founder dashboard, surfaced weekly to the team, and reviewed monthly with action items written for any red metric.

---

## Acceptance — final gate

This tasks document is considered fully executed when:

1. All Phase G1 tasks (T-G.1.1 – T-G.1.20) are complete and the marketing site is live with Lighthouse mobile ≥ 95.
2. All Phase G2 tasks (T-G.2.1 – T-G.2.15) are complete and impersonation has been exercised on a real ticket without incident.
3. All Phase G3 tasks (T-G.3.1 – T-G.3.20) are complete and the compatibility matrix lists ≥ 5 printers, ≥ 3 scanners, ≥ 2 drawers tested.
4. All Phase G4 tasks (T-G.4.1 – T-G.4.30) are complete and at least one tenant is live on production e-fakhata submission for ≥ 14 days with success rate ≥ 95%.
5. All Phase G5 tasks (T-G.5.1 – T-G.5.25) are complete and the app is live in production on Play Store and App Store with crash-free rate ≥ 99.5%.
6. The 100-customer commercial milestone defined in `requirements.md` Acceptance is reached.

Closing of this spec produces an `EXECUTION-REPORT.md` summarizing actuals vs estimates, lessons learned, and the input list for the Tier 3 spec (post-100 growth).
