# Requirements Document: Growth to 100 — From First Paying Customer to 100 Paying Customers

> **Spec ID:** `growth-to-100`
> **Tier:** 2 (growth-blockers)
> **Status:** Draft v1.0
> **Owner:** Safa Othman
> **Target window:** 6 months
> **North-star goal:** Build the **commercial, operational, hardware, compliance, and distribution** apparatus that takes the Kurdish/Iraq ERP from a single paying customer to **100 paying customers** across the Kurdistan Region and federal Iraq — without burning out the founding team on manual ops.

---

## Introduction

The product audit at the start of 2026 confirms that the Kurdish-ERP is technically capable: 276 pages, 115 API endpoint modules, full POS with IndexedDB offline, 3-language RTL i18n, Firestore + Redis + Cloud Run, e-invoice scaffolding, helpdesk and field service. The Tier 1 specs (`world-class-performance`, `empty-state-quick-create`, `database-foundation-excellence`, `firestore-performance-resilience`) close the engineering quality gap.

This spec addresses the **commercial gap** — the 100-customer cliff that begins the day after the first invoice is paid. It exists because every B2B SaaS that has ever shipped has discovered the same five things in the same order:

1. **No one will find you** — the product is invisible without a marketing site, SEO, a discoverable demo, and a pricing page. Word-of-mouth scales linearly; SEO and content scale super-linearly.
2. **The first bug becomes existential** — without an admin impersonation tool, a hotfix mechanism, a status page, and a help desk, the founder spends every minute supporting a single customer manually. The product does not scale past 5–10 customers.
3. **Hardware will betray you** — the POS works on the dev machine and the office printer. It will not work on a Bixolon SRP-330II behind a counter in Sulaymaniyah Bazaar without a compatibility matrix, dialect detection, and a pairing wizard.
4. **Compliance shifts from "supported" to "required"** — the moment a tax inspector visits a customer, the customer asks: "Is your e-fakhata signed? Does your withholding tax line item match the MoF format? Are your IQD denominations correct? Is your customs invoice integrated?" If the answer is anything but "yes, here is the receipt", the customer churns.
5. **The app must be on phones, signed, distributed, and updatable** — Capacitor wraps the web; the **distribution apparatus** (Play Console, App Store Connect, signing keys, FCM, in-app force-update, ASO) is what gets installed on a shop owner's phone in Erbil.

The 1-to-100 customer journey runs across all five at once. This spec defines what *production-grade* looks like in each, with Iraq-specific grounding throughout: real devices, real tax codes, real APIs (MoF, CBI), real distribution challenges (the Apple Developer Program account from inside Iraq, FCM under regional sanctions risk).

The five **Requirement groups** below mirror the five blockers. Each group contains 12–15 sub-requirements written in EARS (Easy Approach to Requirements Syntax) format: *THE \<system\> SHALL …*, *WHEN \<event\> … THE \<system\> SHALL …*.

The acceptance bar for this spec is the **100-customer milestone**: when the platform has 100 paying tenants on the lowest tier or above, all five blockers must no longer be the bottleneck. The bottleneck at that point should be something we want — sales velocity, not support tickets.

---

## Glossary

### Marketing & growth terms

| Term | Definition |
|------|------------|
| **CAC** | Customer Acquisition Cost — total marketing + sales spend divided by paying customers acquired in the same window. |
| **LTV** | Lifetime Value — expected gross margin from a customer across their full lifecycle. |
| **MRR** | Monthly Recurring Revenue — sum of normalized monthly subscription value across active tenants. |
| **ARR** | Annual Recurring Revenue — MRR × 12. |
| **Churn** | Percentage of paying customers who cancel in a period; revenue-churn and logo-churn are tracked separately. |
| **NPS** | Net Promoter Score — −100 to +100 based on "how likely are you to recommend us" 0–10 question. |
| **NRR** | Net Revenue Retention — (starting MRR − churn + expansion) / starting MRR. |
| **Time-to-value (TTV)** | Days from signup to first business value (first invoice issued, first POS sale). |
| **Activation** | A signup that completes a defined set of meaningful first-use actions (issued an invoice, configured a printer, added an item). |
| **Top of funnel** | Awareness-stage traffic (landing visits, blog impressions, social reach). |
| **Bottom of funnel** | High-intent traffic (pricing page, demo request, contact-sales form). |
| **SEO** | Search Engine Optimization — earning organic ranking on Google, Bing, regional engines. |
| **SEM** | Search Engine Marketing — paid search ads (Google Ads, Bing Ads). |
| **ASO** | App Store Optimization — improving discoverability inside the Apple App Store and Google Play Store. |
| **A/B test** | Controlled experiment comparing two variants (control vs treatment) by a primary metric. |
| **Above the fold** | Visible without scrolling on a standard viewport. |
| **CTA** | Call to Action — the button or link a page is designed to convert on. |
| **OG** | Open Graph — meta tags that control social-share preview cards. |
| **Lighthouse** | Google's automated audit tool for performance, accessibility, SEO, PWA. |
| **Lead** | Inbound contact (form fill, demo request, email reply) with enough info to qualify. |
| **MQL** | Marketing-Qualified Lead — meets the quality bar for sales follow-up. |
| **SQL** | Sales-Qualified Lead — sales has confirmed intent and budget. |

### Iraq-specific terms

| Term | Definition |
|------|------------|
| **KRG** | Kurdistan Regional Government — federal region with separate tax administration in some areas. |
| **GoI** | Government of Iraq — federal authority for VAT, customs, e-invoicing mandate. |
| **MoF** | Ministry of Finance — Iraqi tax authority; counterpart to KRG MoF in Kurdistan. |
| **e-Fakhata** | Iraq's electronic-invoicing schema and submission mandate; phased rollout 2024 → 2026 → 2028. |
| **VAT** | Value Added Tax — Iraq has a sales-tax-like regime with VAT-registered taxpayers; in some categories called "sales tax" formally. |
| **WHT** | Withholding Tax — payer deducts a percentage at source; in Iraq, typical rates: 3% on services, 5% on rent, 2% on contracts (varies). |
| **Customs invoice** | Document required for declared imports/exports through Iraqi border points. |
| **Commercial registration number** (CRN) | Issued by Iraqi Ministry of Trade for any registered business. |
| **Tax identification number** (TIN) | Issued by MoF / KRG MoF, present on every registered taxpayer's invoices. |
| **IQD** | Iraqi Dinar — local currency, no decimal subdivision in practice, current circulating denominations 250 / 500 / 1000 / 5000 / 10000 / 25000 / 50000. |
| **CBI** | Central Bank of Iraq — issues the daily official IQD↔USD exchange rate. |
| **Governorate** | Administrative subdivision of Iraq (18 governorates including 3 in KRG). |
| **Mukhtar** | Neighborhood-level official; sometimes required to authenticate residence / business addresses. |
| **Hijri calendar** | Islamic lunar calendar used on some governmental and religious documents alongside Gregorian. |
| **Arabic-Indic digits** | ٠١٢٣٤٥٦٧٨٩ — used on many official Arabic-language documents instead of 0123456789. |
| **Naskh** | Arabic typeface family appropriate for body text and formal documents. |

### Hardware & ESC/POS terms

| Term | Definition |
|------|------------|
| **ESC/POS** | Epson's command set for thermal receipt printers, the de-facto industry standard. |
| **Dialect** | Vendor-specific extension or deviation from baseline ESC/POS. |
| **HID** | Human Interface Device — USB device class; barcode scanners typically present as HID keyboards. |
| **MFi** | "Made for iPhone" — Apple's certification for Lightning / Bluetooth accessories. |
| **BLE** | Bluetooth Low Energy. |
| **Cash drawer kick** | Electrical pulse from the printer to open the connected cash drawer; pin-5 vs pin-2 wiring. |
| **Receipt width** | Thermal receipt media width — 58mm or 80mm dominate the market. |
| **Customer display** | Secondary screen showing transaction details to the customer (LCD pole, VFD, or tablet). |
| **Pre-launch report** | Google Play and Firebase Test Lab automated crawl on physical devices before release. |
| **Capacitor** | Ionic's native runtime that wraps the web app into iOS/Android shells. |

### Support apparatus terms

| Term | Definition |
|------|------------|
| **Impersonation** | Admin temporarily acts as a tenant user (read-only, audited) to debug their data. |
| **Hotfix flag** | Per-tenant feature flag that turns a code path on/off without redeploy. |
| **Status page** | Public page showing real-time uptime, ongoing incidents, scheduled maintenance. |
| **Help portal** | Self-serve KB + ticket submission UI. |
| **Saved reply** | Canned support response usable from the agent inbox. |
| **MTTR** | Mean Time To Resolution. |
| **MTTA** | Mean Time To Acknowledge. |
| **SLO/SLA** | Service Level Objective (internal commitment) / Agreement (contractual commitment). |

---

## Requirements

### Requirement 1 — Marketing & Discovery

THE marketing apparatus SHALL make the product discoverable, credible, and convertible to inbound paying customers through a public marketing site, content, demos, analytics, and conversion infrastructure — independent of the application itself.

**R1.1 — Public marketing site SHALL be a separate deployment.**
THE marketing site SHALL be a separate codebase deployed at the apex (`zoho-kurdish.iq` and the `www` subdomain), distinct from the application origin (`app.zoho-kurdish.iq`). It SHALL NOT share runtime state with the app; it MAY share design tokens via a published package. THE marketing site SHALL be statically rendered for sub-second LCP on 4G Iraqi networks.

**R1.2 — Landing page SHALL convert above the fold.**
THE landing page SHALL render, within the first 600px of viewport on a 360×800 mobile device, all of: (a) a value-proposition headline in Kurdish Sorani as primary text, with Arabic and English sublines; (b) a single primary CTA ("بەخۆڕایی تاقیبکەرەوە" / "Try free"); (c) a hero visual that loads from the same origin within 1.5s LCP; (d) at least one credibility indicator (customer logo, count of active tenants, or KRG/Iraqi-press mention).

**R1.3 — Pricing page SHALL present three tiers with monthly + annual toggles.**
THE pricing page SHALL display three subscription tiers — **Starter** (single-user, single-location, POS + invoicing), **Growth** (up to 5 users, multi-location, all Wave-A modules), **Pro** (unlimited users, all Wave A/B/C modules, e-fakhata integration) — with monthly and annual prices in **IQD primary** and USD secondary. Annual billing SHALL offer a discount of at least 15%. Each tier SHALL display 6–10 features, the next-tier upgrade reason, and a CTA. A comparison table SHALL appear below the tier cards listing every feature with checkmarks.

**R1.4 — At least one interactive demo SHALL exist.**
THE marketing site SHALL embed at least one demo path that a visitor can execute without a signup, EITHER (a) a recorded screen video ≤ 3 minutes in Kurdish narration with Arabic and English subtitles, OR (b) an interactive sandbox tour (Storybook + tour overlay or Arcade.so embed) walking through invoice creation and POS checkout. Both forms ARE preferred; at minimum one is required.

**R1.5 — A minimum of 10 SEO-targeted blog posts SHALL be published before launch.**
THE marketing site SHALL publish, by the milestone of opening sales, at least 10 long-form (1,500+ words) blog posts targeting Iraq-relevant queries. Required topics: (1) Iraq VAT registration step-by-step, (2) Iraq withholding tax for B2B services, (3) Kurdish-language POS setup walk-through, (4) How to choose a thermal printer for an Iraqi shop, (5) E-fakhata explained — what changes for SMBs, (6) IQD vs USD pricing — how to handle dual-currency invoices, (7) Inventory management for Iraqi distributors, (8) Bookkeeping for Iraqi restaurants, (9) Comparison: Zoho Books vs Kurdish-ERP for Iraqi businesses, (10) Setting up multi-location for a chain shop in Erbil/Sulaymaniyah/Duhok. Each post SHALL include hreflang tags for Kurdish, Arabic, and English variants where translated.

**R1.6 — A documentation site SHALL exist at `docs.zoho-kurdish.iq`.**
THE documentation site SHALL be built with Docusaurus or equivalent, separated from the app and marketing site, with at minimum the following sections: Getting Started, POS Setup, Invoicing & Quotes, Inventory, Payroll, e-Fakhata, Hardware Compatibility, API Reference, Glossary, and a Search bar that queries via Algolia DocSearch or self-hosted Meilisearch.

**R1.7 — A sales contact form SHALL route to CRM.**
THE marketing site SHALL host a "Talk to sales" form with fields: full name, business name, governorate, primary use case (POS / accounting / payroll / multi-module / e-fakhata-mandate), expected users, contact phone (Iraq E.164), email, free-text message. Submissions SHALL be POSTed to the application backend, transformed into a Lead record in the `/crm` module, and emit a notification to the `sales@` distribution list and the assigned sales rep's WhatsApp.

**R1.8 — A newsletter email capture SHALL exist with double opt-in.**
THE marketing site footer and at least one in-content placement SHALL surface a newsletter signup. Submissions SHALL trigger a double-opt-in email, and confirmed subscribers SHALL land in a `marketing_subscribers` collection with consent timestamp, source page, and locale. THE newsletter SHALL be GDPR/Iraqi-data-protection-friendly (explicit consent, single-click unsubscribe, retention policy).

**R1.9 — A/B testing infrastructure SHALL be available for the homepage hero and the pricing page.**
THE marketing site SHALL ship an A/B testing layer (Vercel Edge Config + cookie variant assignment, or GrowthBook self-hosted) capable of running at least 3 concurrent experiments. Variants SHALL be deterministic per visitor, persisted for 30 days, and emit `experiment.exposure` and `experiment.conversion` events.

**R1.10 — Analytics SHALL track funnel from impression to paying signup.**
THE marketing site SHALL emit pageviews, scroll depth, CTA clicks, demo starts, demo completions, pricing-tier hovers, and signup-form submissions to a privacy-friendly analytics backend (Plausible self-hosted or PostHog) AND to Google Analytics 4 for compatibility. THE funnel SHALL be reportable end-to-end: marketing impression → signup → activation → first paid invoice.

**R1.11 — Open Graph and structured data SHALL appear on every page.**
EVERY marketing page SHALL emit `og:title`, `og:description`, `og:image` (1200×630 PNG branded), `og:locale`, `twitter:card`, and schema.org JSON-LD where relevant (`Organization`, `Product`, `FAQPage`, `BreadcrumbList`, `Article` for blog posts). THE OG image generation SHALL be automated from page title at build time.

**R1.12 — Marketing site SHALL meet a Lighthouse score floor.**
THE production build of the marketing site SHALL achieve, on the `mobile` Lighthouse profile, Performance ≥ 95, Accessibility ≥ 95, Best Practices ≥ 95, SEO = 100. CI SHALL fail the deploy if any score drops more than 3 points vs `main`.

**R1.13 — Marketing site SHALL be tri-lingual with locale switching.**
THE marketing site SHALL render every page in Kurdish Sorani (default), Arabic, and English with locale stored in a cookie and a switcher in the header. URL structure SHALL be `/ku/`, `/ar/`, `/en/` with `hreflang` and canonical tags correct on every page.

**R1.14 — A cookie consent banner SHALL be presented to first-time EU and EEA visitors.**
WHEN a visitor's IP geolocates to the EU/EEA OR explicit consent is mandated by data-protection rules applicable to Iraq, THE banner SHALL present accept / reject / customize controls. Non-essential analytics SHALL NOT load before consent is given.

**R1.15 — Marketing site SHALL include a sitemap and robots.txt.**
THE marketing site SHALL serve `sitemap.xml` listing every page (including locale variants) and `robots.txt` with `Sitemap:` directive. Submission to Google Search Console and Bing Webmaster Tools SHALL be part of the launch checklist.

---

### Requirement 2 — Customer Support Excellence

THE customer support apparatus SHALL allow a single founder, then a small team, to support up to 100 paying tenants without the per-customer support burden growing linearly with customer count.

**R2.1 — A help portal SHALL be the single entry point for help.**
THE help portal SHALL be hosted at `help.zoho-kurdish.iq` and SHALL combine: a searchable knowledge base, a ticket submission form, a live-chat widget, status-page link, contact information. Trilingual (Kurdish/Arabic/English).

**R2.2 — A minimum of 40 KB articles SHALL be published before launch.**
THE knowledge base SHALL ship with at least 40 articles covering: account setup (5), invoicing (6), POS terminal (8), POS hardware (5), inventory (4), payroll (3), e-fakhata (4), reports (3), billing and subscriptions (2). Each article SHALL have a unique URL, breadcrumb navigation, "was this helpful?" feedback, and a "related articles" sidebar.

**R2.3 — Admin impersonation SHALL be read-only with a visible banner and full audit log.**
WHEN a super-admin invokes "View as tenant", THE backend SHALL issue a session token containing `impersonation: true`, `impersonator_user_id`, `impersonated_tenant_id`, expiring in 30 minutes, scoped to read-only operations. THE frontend SHALL render a fixed top banner reading **"VIEWING AS \<tenant name\> — read-only — expires in MM:SS"** and SHALL block every mutation endpoint client-side AND server-side. EVERY action taken during the impersonation session SHALL be recorded in a `impersonation_audit` collection with a 365-day retention, including all visited routes, all data accessed, and any failed mutation attempts.

**R2.4 — A hotfix per-tenant feature flag mechanism SHALL exist.**
THE backend SHALL support per-tenant feature flag overrides via `/api/admin/feature-flags/tenant/{tenant_id}` (super-admin only), so that a flag can be set to ON or OFF for a single tenant in production without redeploy. Flag changes SHALL emit to an audit log and a Slack/WhatsApp channel for ops visibility.

**R2.5 — A public status page SHALL display uptime, incidents, and maintenance.**
THE status page SHALL be hosted at `status.zoho-kurdish.iq` (Statuspage.io OR Cachet self-hosted on a separate VPS). It SHALL show real-time status for each major service: API, POS sync, e-fakhata submission, payment processing, WhatsApp notifications. Uptime metrics SHALL display 90-day history. Incidents SHALL be posted as updates within 15 minutes of detection. RSS, Atom, and email subscription SHALL be available.

**R2.6 — In-app help widget SHALL be present on every authenticated route.**
THE application SHALL render a floating help button (bottom-right, RTL-aware) that opens an in-app drawer containing: contextual KB suggestions based on current route, a search field, "Contact support" CTA, "WhatsApp us" CTA, and current incident status if any open incident exists.

**R2.7 — A ticketing system SHALL be the system of record for support requests.**
THE ticketing system (hosted Crisp/Intercom Lite for chat + Plain / self-hosted Zammad for ticket store) SHALL ingest tickets from: in-app widget, email to `support@zoho-kurdish.iq`, WhatsApp Business API, marketing site contact form (when subject = support). Tickets SHALL include tenant context, account tier, last 10 audit events, and a one-click "Impersonate" action for the agent.

**R2.8 — Email support SHALL be routed and tracked.**
INBOUND email to `support@zoho-kurdish.iq` SHALL create or reply to a ticket. OUTBOUND replies SHALL be tracked, threaded, and visible in the ticket store. THE mailbox SHALL NOT be a personal inbox — it is a shared inbox via the ticketing system.

**R2.9 — WhatsApp Business SHALL be a supported support channel.**
THE support apparatus SHALL include a WhatsApp Business number with an Iraqi country code, integrated to the ticketing system via 360Dialog OR Twilio. Incoming messages SHALL create tickets; agent replies SHALL appear in the WhatsApp thread to the customer. THE customer's tenant SHALL be matched by phone-number lookup against the `users` collection.

**R2.10 — Saved replies SHALL be localized for the top 30 common questions.**
THE ticketing system SHALL preload at least 30 saved replies in all three languages covering: password reset, invoice print issue, POS printer pairing, e-fakhata submission failure, billing inquiry, plan upgrade, plan downgrade, refund, data export, account deletion request.

**R2.11 — Support SLAs SHALL be published and tracked.**
THE support apparatus SHALL publish on the marketing site the response-time SLA: Pro tier — 2 business hours first response; Growth — 8 business hours; Starter — 24 business hours. THE ticketing system SHALL track MTTA and MTTR per tier and surface SLA breaches to a dashboard.

**R2.12 — On-call rotation SHALL exist for production incidents.**
THE support apparatus SHALL define an on-call rotation (initially: founder always on-call; at 25 customers: weekly rotation among 2 engineers; at 50 customers: PagerDuty / OpsGenie). Severity levels SHALL be defined: S0 (full outage), S1 (major degradation), S2 (single tenant impacted), S3 (cosmetic / minor).

**R2.13 — Incident postmortems SHALL be written for every S0 and S1.**
WITHIN 5 business days of incident resolution, THE on-call engineer SHALL publish a postmortem to a private postmortem store with: timeline, root cause, customer impact, action items. A redacted summary SHALL be posted to the status page for S0 incidents.

**R2.14 — A customer onboarding sequence SHALL run for the first 14 days.**
WHEN a tenant signs up, THE system SHALL trigger a 14-day email + WhatsApp drip with: day 0 — welcome and first-invoice prompt; day 1 — POS hardware pairing guide; day 3 — invite teammates; day 7 — check-in from sales; day 10 — success-story link; day 14 — feedback request and NPS prompt.

**R2.15 — NPS SHALL be collected at 30, 90, and 180 days.**
THE application SHALL prompt active users for NPS at 30, 90, and 180 days post-signup, store results in an `nps_responses` collection, and surface aggregate NPS in the founder dashboard.

---

### Requirement 3 — Hardware Compatibility Matrix

THE POS hardware support SHALL be validated against a curated matrix of devices that match the Iraqi retail market in 2026, with documented dialects, pairing flows, and fallback strategies — replacing today's "ESC/POS supported in principle" claim with a tested guarantee.

**R3.1 — A printer compatibility matrix SHALL be maintained.**
THE compatibility matrix SHALL be a versioned document covering at minimum the five thermal receipt printers most common in Iraqi retail in 2026: **Epson TM-T20III** (USB and Ethernet), **Xprinter XP-T80A** (USB and Bluetooth), **Bixolon SRP-330II** (USB and serial), a representative **Bluetooth 58mm mobile printer** (e.g., Goojprt PT-210 or HOIN HOP-H58), and a **2026 newest entrant** to be selected at procurement time. Each entry SHALL document: model name, firmware version tested, ESC/POS dialect, supported widths (58mm/80mm), cash-drawer pinout, language code page support (CP864 Arabic, CP720 Arabic Transparent, Latin), and one verified test print.

**R3.2 — ESC/POS dialect detection SHALL exist with fallback.**
THE POS hardware layer SHALL implement automatic dialect detection by probing for vendor-specific identifier commands (e.g., GS I n) on pairing. WHEN detection fails or returns an unknown identifier, THE layer SHALL fall back to baseline Epson ESC/POS commands and log a `dialect_detection_failed` event with the raw response bytes.

**R3.3 — Per-printer command profiles SHALL exist in code.**
THE POS hardware layer SHALL ship a `printerProfiles` registry mapping vendor → command map (cut, kick drawer, set code page, print barcode, print QR, init, feed). Each profile SHALL be unit-tested against a recorded byte stream fixture per device model.

**R3.4 — Hardware-pairing wizard SHALL guide a non-technical shopkeeper.**
THE POS settings page SHALL include a "Pair printer" wizard with steps: (1) detect connection type (USB, Bluetooth, network), (2) auto-discover devices, (3) select device, (4) detect dialect or pick manually from a localized list, (5) test print, (6) verify cut, (7) test cash-drawer kick, (8) save profile. Each step SHALL display a Kurdish-language explanation, an illustration, and a "skip" affordance.

**R3.5 — Test-print and verify-cut SHALL be a single-button flow.**
THE POS settings page SHALL surface a "Test print" button that prints a one-page receipt with: company name, current date/time, sequential test number, full code-page sample (Arabic, Kurdish, Latin), a barcode and a QR code, a centered logo. After printing, THE wizard SHALL ask "Did the page cut cleanly?" Y/N — if N, surface a troubleshooting article.

**R3.6 — Barcode scanner compatibility SHALL be matrixed.**
THE compatibility matrix SHALL include at least three barcode scanners: a generic HID-keyboard scanner (Symbol/Honeywell/Zebra USB), a Bluetooth HID scanner, and a camera-based fallback using the device webcam (ZXing / @zxing/browser). The HID path SHALL be the default; the camera path SHALL be available on tablet POS terminals without a USB scanner.

**R3.7 — Camera barcode fallback SHALL run on a Web Worker.**
WHEN the camera path is used, decoding SHALL run on a Web Worker so the POS UI remains at 60fps. The supported symbologies SHALL be EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, ITF, QR.

**R3.8 — Two cash drawers SHALL be tested with documented pin configs.**
THE compatibility matrix SHALL document at least two cash drawers with different pin configurations: a 6-pin "Epson-pinout" drawer and a 4-pin/alternate-pin drawer. THE pairing wizard SHALL allow the operator to pick which pin profile applies to their drawer.

**R3.9 — Customer display options SHALL include three paths.**
THE POS SHALL support three customer-display paths: (a) **LCD pole** connected via serial/USB (rendering line-item summary and total), (b) **Bluetooth tablet** running a slim PWA at `display.zoho-kurdish.iq/{terminal_id}` that subscribes to the terminal's display channel, (c) **Smart TV** via local network with a similar PWA. THE first path is optional; the second and third are required.

**R3.10 — Receipt templates SHALL exist for 58mm and 80mm.**
THE codebase SHALL ship two production receipt templates: `ReceiptTemplate58mm.tsx` (existing or new) and `ReceiptTemplate80mm.tsx` (already exists). Both SHALL render correctly across all printer profiles, with currency in IQD with denomination breakdown, line items, tax breakdown, optional Arabic-Indic digits, optional Hijri date below Gregorian.

**R3.11 — Customer-display content SHALL include item-level updates.**
WHEN a line is added or modified in the POS cart, THE customer display SHALL update within 500ms over the local network. WHEN the cart is cleared or the transaction is voided, the display SHALL show a localized welcome message.

**R3.12 — Hardware vendor partnerships SHALL exist for kit bundles.**
THE growth team SHALL establish at least one partnership with an Iraqi or KRG hardware reseller to offer a "shopkeeper kit" containing a tested printer, cash drawer, barcode scanner, and a tablet with the app pre-installed. THE kit SHALL be listed on the marketing site with a fixed bundled IQD price.

**R3.13 — Hardware lab SHALL be physically procured.**
THE engineering team SHALL maintain a physical hardware lab containing every device on the compatibility matrix. Procurement SHALL be completed before the matrix is published. Cost budget: ~USD 1,500 for printers, drawers, scanners.

**R3.14 — Hardware regression tests SHALL run quarterly.**
EVERY quarter, an engineer SHALL execute the full pairing + test-print + verify-cut + kick-drawer flow against every device on the matrix and update the matrix with the date, firmware seen, and any new issues.

**R3.15 — A "Reset to defaults" SHALL exist on the hardware settings page.**
THE POS settings page SHALL provide a "Reset hardware settings" action that clears all paired profiles and re-runs the wizard.

---

### Requirement 4 — Iraq Compliance Production Grade

THE compliance apparatus SHALL move from "scaffold exists at /l10n-iq and /einvoice" to **production-grade compliance** sufficient to survive a tax-authority inspection and to satisfy the e-fakhata mandate for businesses required to be on it.

**R4.1 — Full e-Fakhata XML schema SHALL be implemented.**
THE backend SHALL implement the full XML invoice schema mandated by GoI for e-fakhata, including header (seller TIN, buyer TIN, invoice number, date, currency, totals), line items (description, quantity, unit price, line total, tax category), tax breakdown (taxable amount per category, tax amount per category), totals (subtotal, total tax, total), and footer (signature placeholder, QR code data). THE schema version SHALL be configurable to allow forward-compatibility with phased rollout updates.

**R4.2 — e-Fakhata invoices SHALL be cryptographically signed.**
THE backend SHALL sign each generated e-fakhata XML with the tenant's MoF-issued private key (PKCS#12 keystore stored encrypted in Google Secret Manager). THE signing format SHALL match the MoF specification (XAdES-BES or as updated). Per-tenant key rotation SHALL be supported.

**R4.3 — e-Fakhata submission SHALL be queued, retryable, and observable.**
WHEN an invoice is marked for e-fakhata submission, THE backend SHALL submit to the MoF endpoint, persist the request and response, retry up to 5 times with exponential back-off on transient errors, and expose submission state (`pending`, `submitted`, `accepted`, `rejected`, `error`) to the application UI. Rejected submissions SHALL surface the MoF error code and a localized explanation.

**R4.4 — VAT registration status SHALL drive invoice behavior.**
EACH tenant SHALL declare on company-profile setup whether they are VAT-registered. WHEN VAT-registered, invoices SHALL include the tenant's TIN, the VAT-registration number, and per-line VAT amounts. WHEN not VAT-registered, the tenant SHALL NOT include a TIN on invoices and SHALL display a localized notice that the issuer is not VAT-registered (treated as final consumer).

**R4.5 — Withholding tax (WHT) SHALL be a first-class concept.**
THE accounting subsystem SHALL implement WHT calculation per invoice with configurable rates per service category: default 3% on professional services, 5% on rent, 2% on contracts (configurable per tenant). EACH invoice SHALL display the WHT amount as a separate line, and the payable total SHALL be net of WHT when the buyer is liable to withhold. THE chart of accounts SHALL include a `wht_payable` and `wht_receivable` account.

**R4.6 — Annual income-tax flat rate SHALL be computed for SMBs.**
THE accounting subsystem SHALL allow tenant setup to declare income-tax regime (flat-rate SMB vs corporate). For flat-rate SMBs, THE reports module SHALL produce an annual income-tax summary with the configured rate applied to taxable income.

**R4.7 — Customs invoice export SHALL be supported.**
THE invoicing subsystem SHALL allow generating customs-invoice variants for import/export transactions with required fields: HS code per line, country of origin, port of entry, declaration number. THE document SHALL export to PDF and to the customs-API XML format when integration is configured.

**R4.8 — Arabic-Indic digit rendering SHALL be a tenant-level option.**
THE rendering layer SHALL support a tenant-level setting `digits: 'western' | 'arabic-indic'` and SHALL apply it across all numeric output (invoices, receipts, reports, dashboards). THE setting SHALL be honored by the PDF generator, the POS receipt printer, and the in-app display.

**R4.9 — IQD currency formatting SHALL be correct.**
WHEN the active currency is IQD, the format SHALL be: integer-only (no decimals), thousands separator per locale (Arabic uses U+066C ARABIC THOUSANDS SEPARATOR, Latin uses comma), suffix " د.ع" (Arabic) or " IQD" (English), with RTL positioning when in RTL context. Currency conversion to/from USD SHALL use the daily CBI rate.

**R4.10 — Cash-drawer denomination support SHALL include all current IQD notes.**
THE cash-drawer reconciliation UI SHALL list rows for each current IQD denomination: 250, 500, 1000, 5000, 10000, 25000, 50000. WHEN obsolete denominations are referenced (older notes), THE UI SHALL flag them as "withdrawn" without rejecting input. THE total SHALL be computed live as the operator counts.

**R4.11 — Hijri date display SHALL be optional.**
EACH tenant SHALL be able to enable Hijri-date display on invoices and receipts. WHEN enabled, the Hijri date SHALL appear below the Gregorian date in the same line group, formatted via the `Intl.DateTimeFormat` with `calendar: 'islamic-umalqura'` or via `hijri-date` library. THE conversion library SHALL be deterministic across timezones.

**R4.12 — Arabic invoice templates SHALL meet professional typesetting standards.**
THE Arabic invoice template SHALL use a Naskh font (e.g., Noto Naskh Arabic or Amiri) bundled with the PDF generator, SHALL render right-to-left, SHALL number pages in Arabic-Indic digits if the tenant uses them, AND SHALL pass a visual-regression test against a reference rendering.

**R4.13 — Ministry of Finance API integration SHALL be a configurable backend module.**
THE backend SHALL ship a `mof_client` module configurable per tenant with auth credentials, the MoF base URL (prod / sandbox), retry policy, and a feature flag to enable submission. WHEN disabled, e-fakhata invoices SHALL be generated and signed but not submitted; the operator SHALL see a clear "Not submitted — MoF integration disabled" badge.

**R4.14 — Iraqi commercial registration number (CRN) and TIN SHALL be first-class company-profile fields.**
THE company-profile schema SHALL include `tin`, `crn`, `governorate`, `vat_registered`, `vat_registration_number`. THESE SHALL be validated for format (TIN is 9 digits; CRN format per governorate), and SHALL appear on every issued invoice.

**R4.15 — Multi-currency with daily CBI rate auto-fetch SHALL be implemented.**
THE backend SHALL poll the Central Bank of Iraq published rate daily at a configurable time (default 09:00 Baghdad time), persist the (IQD, USD, EUR, TRY) tuple, and use that rate for any new transaction created that day. Historical transactions SHALL retain the rate snapshot at creation time, not be retroactively repriced.

**R4.16 — Compliance evidence SHALL be exportable for auditors.**
THE reports module SHALL include a "Tax auditor export" producing a ZIP with: signed e-fakhata XMLs for a date range, the corresponding PDFs, a CSV of all invoices, the WHT register, the VAT register, and a cover sheet listing tenant TIN/CRN. THE export SHALL be downloadable by an authenticated admin only and SHALL emit an audit event.

**R4.17 — Tax law changes SHALL be tracked in a config registry.**
THE codebase SHALL maintain a `taxRulesRegistry.ts` (frontend) and matching backend module documenting current Iraqi VAT and WHT rules with effective-date stamps. WHEN rules change, the registry SHALL receive a new entry rather than mutating in-place, so historical invoices remain reproducible.

**R4.18 — Localization QA SHALL include native-speaker review for tax language.**
ALL Iraqi-tax-related strings (invoice line labels, tax-category names, e-fakhata error explanations) SHALL be reviewed by a native Arabic/Kurdish speaker familiar with Iraqi accounting before each release tagged as a compliance release.

---

### Requirement 5 — Mobile App Distribution Excellence

THE mobile distribution apparatus SHALL deliver the app to the Google Play Store and the Apple App Store with production signing, optimized listings, push notifications, in-app updates, and a beta program — replacing today's Capacitor wrapper with a distributable product.

**R5.1 — Google Play Console account SHALL be active.**
THE company SHALL maintain an active Google Play Console developer account in good standing with verified business identity, payment information, and content policy compliance. The USD 25 one-time fee SHALL be tracked as a CapEx.

**R5.2 — Apple Developer Program SHALL be active.**
THE company SHALL maintain an Apple Developer Program enrollment under an Iraqi entity OR a partner entity if Iraq enrollment proves blocked, with annual USD 99 fee tracked as OpEx. WHEN Iraqi enrollment is blocked due to Apple's regional policy, the fallback SHALL be a partner entity in Turkey or Jordan, with a documented escalation path.

**R5.3 — Android app signing SHALL use Google Play App Signing.**
THE Android build pipeline SHALL produce an AAB (Android App Bundle) signed by an upload key, with Google Play App Signing managing the production signing key. THE upload keystore SHALL be stored in a secure key vault (1Password / Google Secret Manager) with a documented recovery process.

**R5.4 — iOS provisioning SHALL be reproducible.**
THE iOS build pipeline SHALL use App Store Connect API + Fastlane Match (or equivalent) to manage certificates and provisioning profiles in a private Git repo. A new engineer SHALL be able to produce a signed build within 30 minutes of being granted access.

**R5.5 — Play Store listing SHALL be tri-lingual with real-device screenshots.**
THE Play Store listing SHALL include: app title in Kurdish (default), short description (80 chars) and full description (4,000 chars) in Kurdish, Arabic, and English, screenshots from real devices at the required resolutions (phone 16:9, 7" tablet, 10" tablet), a 1024×500 feature graphic, an app icon, content rating, privacy policy URL pointing to `zoho-kurdish.iq/privacy`, contact email.

**R5.6 — App Store listing SHALL mirror Play Store with iOS-specific assets.**
THE App Store listing SHALL include localized title, subtitle, keywords (100 chars per locale), description, promotional text (170 chars), screenshots at the required resolutions for iPhone 6.7"/6.5"/5.5" and iPad 12.9"/11", app preview video (15–30s) where feasible, privacy nutrition labels.

**R5.7 — App icons and splash screens SHALL match Iraqi-brand theme.**
THE app icon SHALL be designed in a palette that nods to Iraqi colors without being exclusionary (the Kurdish-Iraqi brand intersection); SHALL be exported at all required Android (`mipmap-*dpi`) and iOS (`Contents.json`) sizes; SHALL have a transparent-edge maskable variant for Android adaptive icons. Splash screens SHALL render the app logo on a brand background with a localized "Loading…" string.

**R5.8 — In-app update mechanism SHALL support force-update.**
THE app SHALL fetch a `/api/app/version-info` endpoint on every cold start returning: `min_supported_version`, `latest_version`, `force_update: boolean`, `update_message_i18n`. WHEN the running version is below `min_supported_version`, the app SHALL display a non-dismissible modal blocking use and linking to the appropriate store. WHEN the running version is between `min` and `latest`, a dismissible update CTA SHALL appear.

**R5.9 — Push notifications SHALL use FCM for Android and APNs for iOS.**
THE app SHALL integrate Firebase Cloud Messaging on Android and Apple Push Notification service on iOS via Capacitor plugins. ON first launch, the app SHALL request notification permission with a localized explanation. THE backend SHALL store device tokens scoped by `(user_id, tenant_id, platform)`.

**R5.10 — Push topic registration SHALL be per-tenant and per-feature.**
THE app SHALL subscribe each device to FCM/APNs topics by tenant ID and feature (e.g., `tenant_xyz_pos_alerts`, `tenant_xyz_invoice_paid`). WHEN a user changes their notification preferences, the subscription set SHALL update on the next foreground.

**R5.11 — A beta-testing channel SHALL be active.**
THE company SHALL maintain a Google Play Internal Testing track AND an Apple TestFlight group. INITIAL testers SHALL include all engineering, sales, and the founding customers' designated POS operators (≥ 10 testers). A new build SHALL hit the beta channel at least 7 days before a production release.

**R5.12 — Pre-launch report SHALL pass on a representative device pool.**
EVERY release candidate SHALL be subjected to Firebase Test Lab pre-launch report on the **top 12 Iraqi device models** (procured per Q1-2026 market research — recent Samsung A-series, Xiaomi Redmi Notes, Huawei mid-tier, Nokia C-series, iQOO/Realme entry-level). THE acceptance criteria SHALL be zero crashes and zero accessibility regressions vs the previous release.

**R5.13 — Crashlytics SHALL be wired and dashboarded.**
THE mobile builds SHALL integrate Firebase Crashlytics. THE Crashlytics dashboard SHALL be reviewed weekly. WHEN a release shows a crash-free rate below 99.5%, a hotfix release SHALL be initiated.

**R5.14 — App Store Optimization (ASO) SHALL be deliberate.**
THE listings SHALL target the following primary keywords (with documented research): `ERP کوردی`, `POS عراق`, `محاسبة العراق`, `Kurdish ERP`, `Iraq POS`, `فاتورة إلكترونية العراق`, `e-fakhata`. Keyword performance SHALL be tracked monthly via a tool such as AppFollow or Sensor Tower (free tier acceptable initially) and refined per quarter.

**R5.15 — Mobile app download CTAs SHALL appear on the marketing site.**
THE marketing site SHALL include Play Store and App Store badges on the landing page, the pricing page footer, and a dedicated "Download" page. THE badges SHALL be the official localized assets and SHALL link via UTM-tagged URLs to enable funnel analytics.

**R5.16 — Sanctions and regional restrictions SHALL be assessed.**
THE distribution apparatus SHALL document and mitigate the risk that Apple or Google restricts Iraqi-developer accounts or that FCM is inaccessible in some Iraqi networks; mitigations SHALL include the partner-entity fallback (R5.2), a self-hosted push fallback (Capacitor + WebSocket long-poll for in-app live alerts) for users whose FCM is blocked, and clear in-product messaging when push delivery fails.

---

## Non-Functional Requirements Summary

| ID | Area | NFR |
|----|------|-----|
| NFR-G1 | Marketing site uptime | 99.95% monthly |
| NFR-G2 | Marketing site LCP (4G IQ) | ≤ 1.8s on mobile |
| NFR-G3 | Marketing site Lighthouse SEO | = 100 |
| NFR-G4 | Help portal availability | 99.9% monthly |
| NFR-G5 | Status page independence | Hosted on separate provider from app |
| NFR-G6 | Support first-response Pro | ≤ 2 business hours |
| NFR-G7 | Support first-response Growth | ≤ 8 business hours |
| NFR-G8 | Support first-response Starter | ≤ 24 business hours |
| NFR-G9 | Impersonation session TTL | 30 minutes |
| NFR-G10 | Impersonation audit retention | 365 days |
| NFR-G11 | Per-tenant flag propagation | ≤ 30 seconds |
| NFR-G12 | Printer test-print latency | ≤ 2 seconds from tap |
| NFR-G13 | Camera barcode decode | ≤ 250ms per frame |
| NFR-G14 | Customer display update | ≤ 500ms over LAN |
| NFR-G15 | e-Fakhata submission latency | p95 ≤ 5s |
| NFR-G16 | CBI rate fetch | daily, retried on failure |
| NFR-G17 | Mobile cold start | ≤ 2.5s on top-12 device pool |
| NFR-G18 | Mobile crash-free rate | ≥ 99.5% rolling 7-day |
| NFR-G19 | In-app update check | every cold start, ≤ 200ms |
| NFR-G20 | Push delivery success | ≥ 95% measured by foreground confirmation |

---

## Out of Scope

The following are explicitly **out of scope** for this spec:

- **Paid acquisition campaigns** (Google Ads, Meta Ads, TikTok). This spec ships the infrastructure to *receive* traffic; spend is a separate growth program.
- **Public API and partner program**. The product is consumer/SMB-facing in this phase; partner APIs come post-100.
- **Multi-currency beyond IQD/USD/EUR/TRY**. Other currencies are deferred.
- **Direct integrations with Iraqi banks** for ACH/payment rails. Manual reconciliation persists in this phase.
- **Native (non-Capacitor) iOS or Android rewrites.** Capacitor distribution is the only mobile path.
- **Localization beyond Kurdish Sorani, Arabic, English.** Kurmanji and other Iraqi languages are post-100.
- **HIPAA/SOC2 certification.** Compliance is Iraq-tax-focused in this phase; international certifications come with the enterprise tier post-100.
- **Reseller / channel program.** Direct sales only.
- **An on-premises deployment option.** SaaS only.
- **Public bug bounty program.** Private responsible-disclosure email only.
- **Customer-facing AI features** beyond what exists in `/ext/ai`.

---

## Acceptance — the 100-customer milestone

This spec is **accepted** when ALL of the following are true:

1. **Marketing**: marketing site, pricing page, ≥ 10 SEO posts, docs site, demo, contact form, analytics, A/B infra are live for ≥ 30 days; ≥ 1 paying customer attributed to organic search.
2. **Support**: help portal, KB ≥ 40 articles, impersonation, hotfix flag, status page, in-app widget, WhatsApp channel, ticketing all live; support team has handled ≥ 100 tickets in 30 days with SLA compliance ≥ 95%.
3. **Hardware**: compatibility matrix published, 5 printers + 3 scanners + 2 drawers tested, pairing wizard live, 1 vendor partnership signed.
4. **Compliance**: e-fakhata schema implemented end-to-end with at least 1 tenant actively submitting to MoF in production, IQD denominations live in cash-drawer reconciliation, Arabic-Indic digits + Hijri toggle available, CBI rate fetch live, auditor export available.
5. **Mobile**: app live on Play Store and App Store (or App Store via partner entity if blocked), beta channel active, push notifications delivering, in-app update mechanism live, Crashlytics ≥ 99.5%.
6. **Commercial**: ≥ 100 paying tenants on a monthly or annual plan, of which ≥ 70 are on Growth or Pro tier; CAC payback ≤ 9 months on Growth tier.

Until all six are simultaneously true, the spec is in execution.
