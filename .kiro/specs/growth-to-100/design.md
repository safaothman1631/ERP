# Design Document: Growth to 100 — From First Paying Customer to 100 Paying Customers

> **Spec ID:** `growth-to-100`
> **Status:** Draft v1.0
> **Owner:** Safa Othman

---

## Introduction and Architecture Overview

This design realises the five Requirement groups in [requirements.md](./requirements.md). It documents the chosen technical stacks, the integration points to the existing Kurdish-ERP application, the trade-offs made between hosted and self-hosted choices for each subsystem, and the Iraq-specific constraints (sanctions risk, payment-rails availability, hardware import, government API access) that shape every decision.

The high-level architecture below shows how the new growth subsystems sit alongside the existing application without invasive coupling. The application origin (`app.zoho-kurdish.iq`) continues to host the React app on Cloud Run + Firebase. The marketing site, docs site, help portal, status page, and mobile app all live in their own deployments and integrate via well-defined boundaries — typically a thin webhook into the application backend.

```
                          ┌──────────────────────────────────┐
                          │  Visitor / Prospect              │
                          └──────────────┬───────────────────┘
                                         │
              ┌──────────────────────────┼───────────────────────────┐
              │                          │                           │
        ┌─────▼───────┐         ┌────────▼─────────┐         ┌───────▼────────┐
        │ Marketing   │         │ Docs site        │         │ Help portal    │
        │ (Astro,     │         │ (Docusaurus)     │         │ (KB + ticket)  │
        │  Vercel)    │         │ Vercel/Netlify   │         │ Crisp + KB     │
        └─────┬───────┘         └────────┬─────────┘         └───────┬────────┘
              │ contact form              │ search analytics          │ ticket webhook
              │                           │                           │
              ▼                           ▼                           ▼
        ┌────────────────────────────────────────────────────────────────────┐
        │   Application backend  (FastAPI on Cloud Run)                       │
        │   /api/leads  /api/rum/marketing  /api/tickets/ingest  /api/mof/*   │
        │   /api/app/version-info  /api/push/register  /api/cbi-rate          │
        └────────────────────────────────────────────────────────────────────┘
                  ▲                       ▲                          ▲
                  │ impersonate           │ submit                   │ FCM/APNs
                  │ session token         │ e-fakhata XML            │ push topic
        ┌─────────┴────────┐    ┌─────────┴──────────┐     ┌─────────┴────────┐
        │ Super-admin      │    │ MoF API gateway    │     │ Mobile app       │
        │ console + audit  │    │ (signed XML over   │     │ (Capacitor) on   │
        │ (existing)       │    │  HTTPS, queued)    │     │ Play + App Store │
        └──────────────────┘    └────────────────────┘     └──────────────────┘
                                                                       ▲
                                                                       │
                                                            ┌──────────┴──────────┐
                                                            │ Hardware lab        │
                                                            │ (printers, drawers, │
                                                            │  scanners, displays)│
                                                            └─────────────────────┘
```

The remainder of this document is broken into six sections matching the requirement groups, plus an ADR section at the end documenting the 10 most consequential decisions.

---

## Section 1: Marketing Site Architecture

### 1.1 Framework and hosting

**Decision:** Astro on Vercel.

**Why Astro over Next.js Static, Hugo, or Eleventy:** Astro produces zero JS by default for static content (essential for sub-1.5s LCP on Iraqi 4G), supports island hydration when a page needs interactivity (the pricing toggle, the A/B variant assignment, the demo embed), and integrates cleanly with content collections backed by Markdown + frontmatter — which is the form blog posts and pricing copy take. Next.js Static is heavier (React runtime ships even on static pages), Hugo lacks the component composition story we need for sharing brand tokens with the app, and Eleventy lacks the modern image pipeline.

**Why Vercel over Netlify, Cloudflare Pages, or self-hosted Cloudflare R2:** Vercel's edge function for A/B variant assignment is straightforward, image optimization is automatic, preview deployments per PR are first-class, and the Iraqi-edge presence via Cloudflare-backed PoPs is acceptable for our user base. Cloudflare Pages is also acceptable; the deciding factor is Vercel's better Astro support today. Self-hosting on a VPS is rejected because it introduces a per-page-load TTFB penalty from the lone origin server.

**Domain layout:**
- `zoho-kurdish.iq` and `www.zoho-kurdish.iq` → marketing site
- `app.zoho-kurdish.iq` → application
- `docs.zoho-kurdish.iq` → docs site (Docusaurus on a separate Vercel project)
- `help.zoho-kurdish.iq` → help portal (KB + Crisp embedded)
- `status.zoho-kurdish.iq` → status page (Statuspage.io OR self-hosted Cachet)

### 1.2 Content sources

**Decision:** Markdown-driven content collections (no CMS) for v1; migrate to Sanity if the team grows past 3 content contributors.

The marketing site stores all copy as MDX files inside the repo:
```
marketing/
├── src/
│   ├── content/
│   │   ├── posts/              (blog posts, MDX)
│   │   ├── features/           (feature pages)
│   │   ├── customers/          (customer stories)
│   │   └── pages/              (legal pages, about, contact)
│   ├── components/             (shared Astro + React islands)
│   ├── layouts/                (Astro layouts)
│   ├── i18n/                   (translation JSONs per locale)
│   └── styles/
├── public/
│   ├── og-images/              (auto-generated per page)
│   └── illustrations/
├── astro.config.mjs
└── package.json
```

A Sanity migration is documented in ADR-G-09 (deferred). Until then, contributors edit MDX directly via GitHub PRs.

### 1.3 Design system alignment

The marketing site SHALL consume the same brand tokens as the app via a published `@zoho-kurdish/tokens` workspace package. Tokens cover: brand colors (primary `#0F62FE` adjusted for the Iraqi context, secondary `#DA1E28`, neutrals), typography (Vazirmatn for Arabic/Kurdish UI, IBM Plex Sans for English), spacing scale (4 / 8 / 12 / 16 / 24 / 32 / 48 / 64), radii, shadows. Tailwind on the marketing site is configured from these tokens.

### 1.4 SEO and structured data

Every page emits:
- Title tag (≤ 60 chars), meta description (≤ 160 chars), canonical URL with locale.
- `og:title`, `og:description`, `og:image` (1200×630 PNG generated by Vercel OG image API at build time from the page's title and a brand template), `og:locale`, `og:locale:alternate` for the other two languages.
- `twitter:card = summary_large_image`.
- JSON-LD: `Organization` on every page, `Product` on the homepage and pricing page, `FAQPage` on the FAQ page, `Article` + `BreadcrumbList` on blog posts.
- `<link rel="alternate" hreflang="..." />` linking the three locale variants and `x-default`.
- `sitemap.xml` produced by `@astrojs/sitemap` integration, listing every page in every locale.
- `robots.txt` with `Sitemap:` directive.

### 1.5 Ten blog-post outlines

Outlines below are the editorial seed for R1.5. Each is a 1,500–2,500 word piece by a bilingual Iraqi accountant or shop-owner-coached writer.

1. **Iraq VAT registration step-by-step (2026 edition)** — eligibility threshold, the registration form at the MoF, the timeline, what changes the day after registration, common rejection reasons. Target query: "تسجيل ضريبة القيمة المضافة العراق".
2. **Withholding tax for B2B services in Iraq — the 3% you might forget** — when WHT applies, how to compute, how to record in books, how to remit to MoF, what the buyer's certificate looks like. Target query: "ضريبة الاستقطاع العراق".
3. **Kurdish-language POS setup in a single afternoon** — picking a printer, pairing a cash drawer, connecting a barcode scanner, training a cashier. Target queries: "POS کوردی", "صندوق فروشتن کوردی".
4. **Choosing a thermal printer for an Iraqi shop in 2026** — Epson vs Xprinter vs Bixolon vs no-name BT, cost in IQD, where to buy in Baghdad / Erbil / Sulaymaniyah, what fails first. Target query: "thermal printer Iraq".
5. **e-Fakhata explained — what changes for SMBs in 2026** — the mandate timeline, what an e-fakhata XML looks like, who must sign and submit, what penalties look like, how the Kurdish-ERP automates this. Target query: "e-fakhata العراق".
6. **IQD vs USD pricing — how to handle dual-currency invoices** — when to quote in USD, when to invoice in IQD, how the CBI rate works, how to display both on a receipt without confusing the customer. Target query: "دۆلار و دینار فاکتور".
7. **Inventory management for Iraqi distributors** — multi-warehouse setup, lot tracking for pharmaceuticals, expiry alerts, stock reconciliation cycles. Target query: "إدارة المخزون العراق".
8. **Bookkeeping for an Iraqi restaurant** — daily Z-tape reconciliation, COGS computation, supplier payments, the closing checklist. Target query: "محاسبة مطعم العراق".
9. **Zoho Books vs Kurdish-ERP for Iraqi businesses — a side-by-side** — features matrix, pricing in IQD, Iraq-specific gaps (e-fakhata, WHT, Arabic-Indic, Kurdish UI), data residency. Target queries: "Zoho Books العراق", "ERP عراقي".
10. **Setting up multi-location for a chain shop across the KRG** — per-branch tax rates, per-branch printers, central reporting, inter-branch transfers, role-based access by branch. Target queries: "چەند فرۆشگا کۆنتڕۆڵ", "إدارة سلسلة محلات العراق".

### 1.6 A/B testing infrastructure

**Decision:** Vercel Edge Config + cookie variant assignment for v1; migrate to GrowthBook if experiment volume exceeds 10 concurrent.

Implementation: an Astro middleware reads or writes a `_abc` cookie containing a 64-bit deterministic visitor ID, hashes it with the experiment slug, and assigns to a variant bucket. Variants are exposed to the page as a custom header (`x-abc-experiment-pricing-headline=B`) and consumed by Astro components via `Astro.request.headers`. Exposure and conversion events are emitted to Plausible Custom Events + the application backend's `/api/rum/marketing` endpoint, keyed by experiment slug + variant.

Three experiments at launch:
- `pricing-headline` — "Save hours every day" vs "Built for Iraqi shops, in Kurdish"
- `landing-hero-cta` — "Try free for 30 days" vs "See a 90-second demo"
- `signup-form-fields` — 4-field signup vs 2-field signup

### 1.7 Analytics

**Decision:** Plausible (self-hosted on a small VPS) for privacy-friendly aggregate analytics + Google Analytics 4 in parallel for compatibility with ad platforms.

Events emitted:
- Pageview (path, locale, referrer, device class)
- `scroll_depth_25 | 50 | 75 | 100`
- `cta_click` with `cta_id`
- `demo_start`, `demo_complete`, `demo_step_X`
- `pricing_tier_hover` with `tier`
- `signup_started`, `signup_completed`, `signup_failed`
- `experiment_exposure`, `experiment_conversion`
- `download_app_click` with `platform`

A daily ETL job aggregates GA4 + Plausible exports into the founder dashboard's `marketing_funnel` collection.

---

## Section 2: Customer Support Stack

### 2.1 Help portal stack

**Decision:** Hybrid — Crisp for live chat + Notion (private but with public-facing share) for the KB + a custom admin tool inside the app for impersonation. Plain.com is the upgrade target if Crisp's per-seat pricing becomes binding.

The trade-off space:
- **Fully hosted (Intercom):** highest-quality agent inbox, fastest setup, USD 39–139/seat/month, becomes expensive at 100 customers when 3 agents are needed.
- **Fully hosted (Crisp):** USD 25–95/team/month, generous free tier, decent inbox, supports WhatsApp + email + chat in one inbox, weakest analytics.
- **Self-hosted (Zammad / Chatwoot):** zero per-seat cost, full data sovereignty, requires VPS ops, weakest live-chat UX.
- **Hybrid:** Crisp for chat + the Iraqi WhatsApp number, Notion (or Outline self-hosted) for KB, custom admin for impersonation. Cheapest with the lowest ops burden.

Selection: **Hybrid**. Crisp is chosen because (a) its WhatsApp Business integration is well-documented for the Twilio path and (b) its trilingual inbox is acceptable.

### 2.2 KB structure

Forty articles before launch, structured under nine collections:
- **Getting started (5)** — account setup, first invoice, first POS sale, inviting users, locale switching.
- **Invoicing (6)** — creating an invoice, adding a tax rate, applying WHT, e-fakhata enablement, recurring invoices, credit notes.
- **POS terminal (8)** — first-time pairing, daily open/close, refunds, holds, splits, customer display, kitchen display, offline mode.
- **POS hardware (5)** — Epson TM-T20III, Xprinter XP-T80A, Bixolon SRP-330II, Bluetooth scanners, cash drawers.
- **Inventory (4)** — items + variants, multi-warehouse, stock adjustments, reorder points.
- **Payroll (3)** — employee setup, monthly run, payslip distribution.
- **e-Fakhata (4)** — what it is, enabling for your tenant, troubleshooting submission errors, viewing the audit register.
- **Reports (3)** — sales by item, profit & loss, VAT register.
- **Billing & subscriptions (2)** — upgrading your plan, downgrading or cancelling.

Each article: H1 title, ≤ 200-word intro, screenshots (annotated, captured at the canonical 1366×768 viewport for desktop and 360×800 for mobile), step-by-step list with ≤ 8 numbered steps per chunk, "common issues" callout, "related articles" footer, "Was this helpful? Yes/No" feedback button.

### 2.3 Admin impersonation — design

**Constraint:** impersonation is the single highest-trust feature in the system. The design here prioritizes auditability and a clear "off-ramp" over convenience.

**Token model:**

When a super-admin clicks "View as ⟨tenant⟩" on the Super Admin Console:

1. Backend (`POST /api/admin/impersonate`) verifies the caller has the `superadmin.impersonate` permission.
2. Backend writes an `impersonation_audit` document: `{ id, impersonator_user_id, impersonator_email, target_tenant_id, target_user_id (nullable), started_at, expires_at = +30 min, reason: string, ip, user_agent, scope: 'read-only' }`.
3. Backend issues a short-lived JWT with claims: `sub: <impersonator_user_id>`, `act: { sub: <target_user_id> }` (RFC 8693 actor claim), `tenant: <target_tenant_id>`, `impersonation: true`, `aud: ['app']`, `exp: <iso>`, `scope: 'read-only'`, `audit_id: <impersonation_audit_id>`.
4. Frontend stores the token in `sessionStorage` (NOT in a cookie — so it cannot bleed into background tabs) and uses it as the `Authorization: Bearer` header.
5. The application's Auth context detects `impersonation: true` and:
   - Renders a fixed top banner across all routes: `"VIEWING AS <tenant.name> — read-only — expires in MM:SS"` with a "Stop impersonation" button.
   - Blocks every component-level mutation handler from firing; the banner's button is the only mutation allowed.
   - Hides any feature that triggers external side-effects (sending emails, printing receipts, etc.).
6. The application's API client adds `x-impersonation: true` to every request.
7. The backend's middleware:
   - Verifies the token's `impersonation: true` and `scope: 'read-only'`.
   - Rejects every non-GET request with 403 unless the route is in an explicit allowlist (`/api/auth/impersonate/end`).
   - Records every request to the `impersonation_audit_events` subcollection.
8. On expiry or "Stop impersonation":
   - Frontend clears the session token, redirects to `/admin`.
   - Backend marks the audit doc `ended_at`.

**Audit retention:** 365 days. Audit docs are immutable.

**UI banner specification:**
- Background: red (`#DA1E28`), white text, 56px tall, fixed at top, on top of everything (z-index 9999).
- Text: `"VIEWING AS: <tenant_name> — READ-ONLY — Expires in MM:SS — [Stop]"`.
- Countdown live-updating.
- Mobile: text wraps; "Stop" button always visible.
- Color is non-customizable; no theme can hide this banner.

### 2.4 Status page

**Decision:** **Statuspage.io** at USD 29/month at the lowest paid tier (which includes the custom subdomain) for v1. Migrate to self-hosted Cachet if the cost becomes binding.

Why not self-hosted from the start: a status page MUST be on infrastructure independent of the application (otherwise it goes down with the app). Self-hosted Cachet on a separate VPS is cheap (USD 5/month VPS) but requires us to monitor the monitor. Statuspage.io eliminates that overhead at a manageable price.

Component model on Statuspage:
- **API** — derived from synthetic probe to `/api/health`.
- **POS Sync** — derived from a synthetic write-to-Firestore-and-read probe.
- **e-Fakhata Submission** — derived from a sandbox submission probe.
- **Payment Processing** — manual for now (no automated probe to bank APIs).
- **WhatsApp Notifications** — derived from a daily test message and delivery confirmation.

Each component has 90 days of history publicly visible. Probe results push to Statuspage every 60 seconds via the Statuspage API; a Cloud Function runs the probes from us-central1.

### 2.5 WhatsApp Business integration

**Decision:** **360Dialog** (a WhatsApp Business Solution Provider with a strong presence in the MENA region) as the primary integration; **Twilio** as the documented fallback if onboarding stalls.

Why 360Dialog: their MENA / Iraq onboarding is faster, they support Iraqi country codes out of the box, and the per-message cost is lower than Twilio for the conversation-based pricing model.

Architecture:
```
WhatsApp user ──► WhatsApp ──► 360Dialog webhook ──► Backend /api/whatsapp/inbound
                                                            │
                                                            ▼
                                                Lookup user/tenant by phone
                                                            │
                                                            ▼
                                                Create or append ticket
                                                            │
                                                            ▼
                                                Forward to Crisp inbox

Crisp agent reply ──► Crisp webhook ──► Backend /api/whatsapp/outbound ──► 360Dialog ──► WhatsApp
```

A localized opt-in message is sent on first contact: *"بەخێر بێیتەوە — ئەم ژمارەیە بۆ پشتگیریی Kurdish-ERP-ە. ناوی شیرکەتت چییە؟"*

### 2.6 In-app help widget

Component: `frontend/src/components/help/HelpWidget.tsx`. Floating button at bottom (RTL-aware: bottom-left for RTL locales, bottom-right for LTR). On click, opens a drawer with:
- A search box that hits a `/api/help/search` endpoint backed by the KB index.
- Contextual KB suggestions filtered by `route` (e.g., on `/pos/terminal`, suggest POS articles first).
- "Contact support" CTA → opens Crisp inline OR drops to email if Crisp is loading.
- "WhatsApp us" CTA → `wa.me/{support_number}?text={prefilled}`.
- Current incident banner if any open incident exists, fetched from `/api/status/current`.

The widget defers loading of the Crisp SDK until first interaction, so it does not affect first-load LCP.

### 2.7 Saved replies

Stored in a `support_saved_replies` collection: `{ id, locale, title, body, tags, last_updated }`. Crisp pulls the list at agent inbox load.

Initial seed (30 replies × 3 locales = 90 documents):
- Password reset, plan upgrade, plan downgrade, refund process, data export, account deletion, POS printer not pairing, e-fakhata submission failed (cert), e-fakhata submission failed (validation), inventory not syncing, mobile app crash, mobile app update prompt, IQD denomination wrong, withholding tax not calculating, multi-location setup, user invite not received, receipt format wrong, customer display blank, barcode scanner double-scan, currency display wrong, Hijri date not showing, Arabic-Indic digits not rendering, payroll calculation question, recurring invoice setup, customs invoice question, sales tax registration question, CBI rate not updating, kitchen display offline, beta tester onboarding, contact information update.

### 2.8 Onboarding sequence (14-day drip)

Implemented by a backend scheduler running on APScheduler. On signup, a `onboarding_track` document is created and the scheduler enqueues events for days 0, 1, 3, 7, 10, 14. Each event fires an email (via SendGrid) + a WhatsApp template message (via 360Dialog). The message templates are stored in a `messaging_templates` collection per locale.

A user who completes a key milestone (e.g., first invoice issued by day 1) SHALL receive a different day-3 message (skip the prompt, send a more advanced tip).

### 2.9 NPS collection

Implemented as an in-app modal that appears once per user at days 30, 90, and 180 post-signup, deferred to the user's next active session after the trigger fires. The modal stores `{ user_id, tenant_id, score, comment, prompt_day, locale, app_version, created_at }` in an `nps_responses` collection.

---

## Section 3: Hardware Compatibility

### 3.1 ESC/POS adapter pattern

The POS hardware layer SHALL implement an adapter pattern with three layers:
1. **Transport layer** — abstracts USB, Bluetooth, network. Implementations: `UsbTransport`, `BluetoothTransport`, `NetworkTransport`.
2. **Protocol layer** — abstracts ESC/POS dialect. Implementations: `EpsonProfile`, `XprinterProfile`, `BixolonProfile`, `GenericProfile`. Each implements the same `IPrinterProfile` interface: `init()`, `setCodePage(cp)`, `printText(s, options)`, `printBarcode(code, type)`, `printQR(data)`, `feedLines(n)`, `cut(mode)`, `kickDrawer(pin)`.
3. **Receipt rendering layer** — translates a `ReceiptModel` (lines, total, taxes, metadata) into a sequence of protocol calls.

### 3.2 Printer profile registry

```ts
// frontend/src/pos/hardware/printerProfiles.ts
export const printerProfiles: Record<string, PrinterProfile> = {
  'epson-tm-t20iii': {
    vendorId: 0x04b8,
    productIds: [0x0e15, 0x0e20],
    dialect: 'escpos-epson',
    width: 80,
    codePages: ['CP864', 'CP720', 'CP437'],
    cut: { command: [0x1d, 0x56, 0x42, 0x00], delay: 50 },
    kickDrawer: { pin5: [0x1b, 0x70, 0x00, 0x32, 0x96], pin2: [0x1b, 0x70, 0x01, 0x32, 0x96] },
    feedAfterPrint: 3,
  },
  'xprinter-xp-t80a': { ... },
  'bixolon-srp-330ii': { ... },
  'generic-bt-58mm': { ... },
  'newest-2026': { ... }, // placeholder, populated at procurement
};
```

Each profile is unit-tested against a recorded byte stream — a Python fixture script captured the actual bytes the printer emitted when sending the same command, and the test asserts the generated byte sequence matches.

### 3.3 Dialect detection

On pairing, the wizard sends `GS I 1` (Printer model ID, baseline ESC/POS). The response is interpreted:
- Epson printers respond with vendor-specific identifier bytes.
- Xprinter often returns a custom string.
- Bixolon returns a different identifier.
- Unknown response → `GenericProfile` with safe baseline commands.

The detected profile + the user's confirmation in the wizard is persisted in IndexedDB as the active profile for the terminal.

### 3.4 Cash drawer firing matrix

| Profile | Drawer pinout | Command |
|---------|---------------|---------|
| Epson TM-T20III | Pin 5 (standard) | `1B 70 00 32 96` |
| Epson TM-T20III | Pin 2 (alternate) | `1B 70 01 32 96` |
| Xprinter | Pin 5 | `1B 70 00 32 96` |
| Bixolon | Pin 5 | `1B 70 00 19 78` |
| Generic | Pin 5 | `1B 70 00 32 96` (best-effort) |

The wizard allows the operator to test pin 5 first, then pin 2 if pin 5 does not kick the drawer.

### 3.5 Barcode scanner support

Two paths:
- **HID keyboard wedge (default):** scanner appears as a USB or Bluetooth keyboard. POS UI captures input via a global keypress listener with an "in barcode mode" timer (≥ 3 chars in 100ms = barcode). Decoded value is dispatched to the active product-search context. No SDK required.
- **Camera fallback:** uses `@zxing/browser` running in a Web Worker. Triggered by a "scan with camera" button on tablets. Decoded value flows into the same product-search context.

Symbology coverage: EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, ITF, QR.

### 3.6 Customer display

Three paths:
- **LCD pole (serial / USB-serial):** uses `node-serialport` wrapped behind the Capacitor desktop adapter or a small WebSerial polyfill on Chromium-based desktop browsers. Renders the last-line + total only.
- **Bluetooth tablet running display PWA:** a separate route at `display.zoho-kurdish.iq/{terminal_id}` that subscribes to a Firestore document `pos_display_state/{terminal_id}` updated by the POS terminal as the cart changes. Rendered as a full-screen card with the cart total and last line item.
- **Smart TV on LAN:** same PWA URL; opens in the TV browser and displays the same content.

### 3.7 Hardware-pairing wizard

A 7-step wizard at `/pos/settings/hardware/pair`:
1. Choose device type (printer / scanner / drawer / display).
2. Choose connection (USB / Bluetooth / Network).
3. Auto-discover (lists detected devices).
4. Detect dialect (auto-probe; fallback to manual list).
5. Test print (renders test receipt; confirms readability).
6. Verify cut (Y/N prompt).
7. Test kick drawer (if drawer is paired).

Each step has an illustration, Kurdish primary text, Arabic and English alternates, a "skip" link with a clear consequence (e.g., "Skip cut test — receipts may not auto-cut"), and a "back" affordance.

### 3.8 Vendor partnership program

Outreach to: two Iraqi retail hardware distributors in Baghdad, one in Erbil. Goal: at least one partnership signing a co-marketing agreement where the partner sells a "Kurdish-ERP Shopkeeper Kit" containing:
- An Epson TM-T20III printer (or Xprinter XP-T80A as the value option)
- An RJ-12 cash drawer with two pinout options
- A USB or Bluetooth barcode scanner
- A 10" Android tablet with the app pre-installed

The kit is listed on the marketing site at a bundled IQD price; the partner handles fulfillment; the company earns a referral fee and a logo placement.

---

## Section 4: Iraq Compliance Production

### 4.1 e-Fakhata XML schema

The schema follows MoF specification. Schema versioning is a first-class concern: each version is stored as a separate XSD in `backend/efakhata/schemas/v{N}.xsd` and the generator picks the version per tenant config.

Schema (simplified):
```xml
<Invoice xmlns="urn:iq:mof:fakhata:v2" version="2.0">
  <Header>
    <InvoiceNumber>INV-2026-00001</InvoiceNumber>
    <IssueDate>2026-05-29</IssueDate>
    <IssueTime>14:30:00+03:00</IssueTime>
    <Currency>IQD</Currency>
    <Type>Standard</Type>
  </Header>
  <Seller>
    <TIN>123456789</TIN>
    <CRN>...</CRN>
    <Name>...</Name>
    <Address>...</Address>
    <VATRegistration>...</VATRegistration>
  </Seller>
  <Buyer>
    <TIN>...</TIN>
    <Name>...</Name>
  </Buyer>
  <Lines>
    <Line number="1">
      <Description>...</Description>
      <Quantity>1</Quantity>
      <UnitPrice>10000</UnitPrice>
      <LineTotal>10000</LineTotal>
      <TaxCategory>VAT-Standard</TaxCategory>
      <TaxRate>0.0</TaxRate>
      <TaxAmount>0</TaxAmount>
    </Line>
  </Lines>
  <TaxBreakdown>
    <Category code="VAT-Standard" taxable="10000" rate="0.0" amount="0"/>
  </TaxBreakdown>
  <Totals>
    <Subtotal>10000</Subtotal>
    <TotalTax>0</TotalTax>
    <Total>10000</Total>
  </Totals>
  <QRCode>...</QRCode>
  <Signature>...</Signature>
</Invoice>
```

### 4.2 Signing flow

Per-tenant PKCS#12 keystore stored in Google Secret Manager keyed by `tenant_id`. On submission:
1. Generate the XML from the invoice.
2. Canonicalize (XML C14N).
3. Compute SHA-256 digest.
4. Sign with the tenant's private key (XAdES-BES envelope).
5. Embed the signature into the `<Signature>` element.
6. Validate against the XSD.
7. Queue submission.

### 4.3 MoF submission flow

```
Invoice ────► Mark for submission ────► Queue
                                          │
                                          ▼
                                  Worker pulls from queue
                                          │
                                          ▼
                                   Generate + sign XML
                                          │
                                          ▼
                                   POST to MoF endpoint
                                          │
                              ┌───────────┼───────────┐
                              ▼           ▼           ▼
                          200 OK       4xx        5xx / timeout
                              │           │           │
                              ▼           ▼           ▼
                       Mark accepted  Mark rejected  Retry (5 attempts,
                                                     exp back-off: 30s,
                                                     2m, 10m, 1h, 6h)
```

Submission state tracked in `efakhata_submissions` collection: `{ id, tenant_id, invoice_id, state, attempts, last_attempt_at, mof_request_id, mof_response_code, mof_response_body, signed_xml_url }`.

UI: each invoice detail page shows a "e-Fakhata" badge with state and a "Resubmit" action for `rejected` or `error` states.

### 4.4 Withholding tax computation

WHT model: a per-tenant rules table `wht_rules`:
```
{ category: 'professional_services', rate: 0.03, account_dr: 'WHT-Receivable', account_cr: 'Revenue' }
{ category: 'rent', rate: 0.05, ... }
{ category: 'contracts', rate: 0.02, ... }
```

On invoice with a line categorized to `professional_services`, the WHT line is added automatically with the configured rate. The payable total is presented as: `Net = Gross - WHT`.

The chart of accounts is extended with `wht_payable` (liability) and `wht_receivable` (asset, for cases where we are the WHT-er).

### 4.5 Arabic-Indic digit rendering

A render utility:
```ts
// frontend/src/lib/digits.ts
export function formatDigits(value: number, mode: 'western' | 'arabic-indic'): string {
  const western = value.toLocaleString('en-US');
  if (mode === 'western') return western;
  return western.replace(/\d/g, d => String.fromCharCode(0x0660 + Number(d)));
}
```

Applied at every numeric display: invoice total, receipt total, dashboard KPIs, report tables, POS cart, page numbers in PDFs.

### 4.6 IQD currency formatting

```ts
// frontend/src/lib/currency.ts
export function formatIQD(amount: number, locale: 'ar' | 'ku' | 'en', digits: 'western' | 'arabic-indic'): string {
  const integer = Math.round(amount);
  const formatted = integer.toLocaleString(locale === 'en' ? 'en-US' : 'ar-IQ');
  const display = digits === 'arabic-indic' ? toArabicIndic(formatted) : formatted;
  const suffix = locale === 'en' ? ' IQD' : ' د.ع';
  return display + suffix;
}
```

The receipt printer profile applies the same formatting when emitting text bytes (after code-page translation).

### 4.7 IQD denomination cash-drawer reconciliation

UI: a table with one row per current denomination (250, 500, 1000, 5000, 10000, 25000, 50000), one input per row for the count, a computed subtotal per row, and a grand total compared with the expected drawer total. Withdrawn denominations appear with a "withdrawn" tag and a tooltip but accept input.

### 4.8 Hijri date support

Library: native `Intl.DateTimeFormat` with `calendar: 'islamic-umalqura'`. Format helper:
```ts
export function formatHijri(date: Date, locale: 'ar' | 'ku' | 'en'): string {
  return new Intl.DateTimeFormat(`${locale}-IQ-u-ca-islamic-umalqura`, {
    day: 'numeric', month: 'long', year: 'numeric'
  }).format(date);
}
```

Tenant setting `display_hijri: boolean` controls whether the Hijri date appears alongside the Gregorian on invoice headers and receipts.

### 4.9 Arabic typesetting in PDFs

PDF generation uses `pdfkit` or `weasyprint` server-side. Fonts bundled: **Noto Naskh Arabic** (primary) and **Amiri** (alternative for formal documents). RTL rendering ensured by setting the document direction and using the right glyph shaping (handled by harfbuzz under `weasyprint`).

A visual-regression test renders a reference Arabic invoice and compares with a baseline PNG; >2% pixel difference fails CI.

### 4.10 Multi-currency with CBI rate

Daily fetcher: a Cloud Scheduler trigger at 09:00 Baghdad time invokes a Cloud Function that:
1. GETs the Central Bank of Iraq's published rate page (or API if available).
2. Parses out the IQD↔USD, IQD↔EUR, IQD↔TRY rates.
3. Persists into `exchange_rates/{YYYY-MM-DD}` with the timestamp.
4. Falls back to the previous day's rate if the fetch fails, with an alert.

Invoices store the rate snapshot at creation time on `invoice.exchange_rate_at_issue` so historical reporting is reproducible.

### 4.11 Customs invoice export

Customs invoices are a variant of the standard invoice with extra fields per line: HS code, country of origin, port of entry. The PDF template `CustomsInvoice.tsx` renders these fields. XML export uses the schema mandated by the Iraqi Customs API when integration is enabled; otherwise a PDF is generated for paper submission.

---

## Section 5: Mobile Distribution

### 5.1 Capacitor build pipeline

```
                  Local dev                  CI on push
                  ─────────                  ──────────
React app build ──► npx cap copy ──► .ipa (iOS) ──► TestFlight
                                ──► .aab (Android) ──► Play Internal
```

Build is automated in GitHub Actions:
- `release-android.yml`: triggered on tagged release; builds AAB; uploads to Play Console Internal track.
- `release-ios.yml`: triggered on tagged release; builds IPA on macOS runner; uploads to App Store Connect TestFlight via Fastlane.

### 5.2 Android signing

Keystore stored encrypted in GitHub Actions secrets (base64-encoded JKS file + alias + password). Google Play App Signing manages the production key; we only manage the upload key. Loss of the upload key is recoverable via Google support; loss of the Play signing key is NOT possible because Google holds it.

### 5.3 iOS provisioning

**Fastlane Match** stores certificates and provisioning profiles in a private GitHub repo, encrypted with a passphrase shared via 1Password. New engineer onboarding: clone the iOS repo, run `fastlane match development`, the passphrase is requested once, certificates are installed in the macOS keychain.

### 5.4 FCM + APNs push

Architecture:
```
Backend ──► /api/push/send ──► dispatch
                                  │
                ┌─────────────────┼─────────────────┐
                ▼                                   ▼
            FCM (Android)                       APNs (iOS)
                │                                   │
                ▼                                   ▼
            Device                              Device
```

Topic strategy: `tenant_{tenant_id}` for tenant-wide alerts, `user_{user_id}` for personal alerts, `tenant_{tenant_id}_pos` for POS-specific events.

Token lifecycle:
- On launch, the app requests permission and obtains a token.
- Token POSTed to `/api/push/register` with `{ user_id, tenant_id, platform, token, app_version, device_model }`.
- On token refresh (FCM emits a callback), re-register.
- On logout, deregister.

### 5.5 In-app update mechanism

Component: `frontend/src/components/mobile/UpdateGate.tsx`.

On Capacitor cold start, fetch `GET /api/app/version-info`:
```json
{
  "min_supported_version": "1.2.0",
  "latest_version": "1.4.1",
  "force_update": false,
  "store_urls": { "android": "...", "ios": "..." },
  "update_message_i18n": { "ku": "...", "ar": "...", "en": "..." }
}
```

Logic:
- If running version < min_supported_version OR `force_update: true` → non-dismissible modal, deep link to store.
- If running version < latest_version → dismissible banner, deep link.
- Otherwise → no UI.

### 5.6 Pre-launch report

Firebase Test Lab is invoked as part of the release CI. The device pool is configured per Iraq market research (collected Q1 2026; refreshed annually). Failure mode: the release is blocked from promotion until the report is investigated.

The top 12 device pool (illustrative; refreshed annually):
- Samsung Galaxy A14, A24, A34
- Xiaomi Redmi Note 12, Note 13
- Huawei Nova 11
- Nokia C32
- iQOO Z7
- Realme C55
- Tecno Spark 10
- Infinix Hot 30
- iPhone SE (3rd gen) — for iOS

### 5.7 App version + force-upgrade backend

Backend endpoint `/api/app/version-info` is administered via a `mobile_versions` collection. Operations team can flip `force_update: true` on a release in an incident.

### 5.8 Crashlytics

Firebase Crashlytics is wired through Capacitor plugins. Weekly review meeting. Hotfix release initiated if crash-free rate falls below 99.5% over 7 days.

### 5.9 ASO

Listing copy is iterated on monthly with keyword research from AppFollow's free tier. Localized listings: Kurdish (primary), Arabic, English. Screenshots regenerated when major UI changes ship; captured on real devices.

### 5.10 Sanctions risk mitigation

The Apple Developer Program enrollment is the highest sanctions exposure: Apple has historically restricted developer accounts for Iraq-based legal entities at unpredictable cadence. Mitigation:
- Primary: enrol from an Iraqi entity if accepted.
- Fallback: enrol from a partner entity in Turkey or Jordan, with a written agreement assigning all rights to the Iraqi parent.
- Documented escalation path to Apple developer support.

For FCM: monitored delivery success per tenant; if a tenant shows ≥ 20% delivery failure, an in-app WebSocket fallback (long-poll) is opened to keep real-time alerts working.

---

## Section 6: Architecture Decision Records (ADRs)

### ADR-G-01 — Marketing site framework: Astro

**Status:** Accepted. **Date:** 2026-05.
**Context:** Need a static, multilingual, fast marketing site with content collections and a small interactive surface (pricing toggle, A/B variant assignment, demo embed).
**Decision:** Astro 4 with `@astrojs/sitemap`, `@astrojs/image`, MDX content collections, Tailwind via `@astrojs/tailwind`.
**Consequences:** Excellent LCP; team learns one more framework; harder to share React components 1:1 with the app (but acceptable via published token package).

### ADR-G-02 — Marketing site host: Vercel

**Status:** Accepted.
**Context:** Edge functions for A/B testing, image optimization, preview deployments.
**Decision:** Vercel Pro tier (USD 20/seat/month).
**Alternatives:** Cloudflare Pages, Netlify.

### ADR-G-03 — Content management: MDX in repo (defer Sanity)

**Status:** Accepted.
**Context:** 2 contributors at launch; CMS adds vendor cost and lock-in.
**Decision:** MDX in repo; revisit at 3+ contributors.

### ADR-G-04 — Help portal stack: Crisp + Notion + custom admin

**Status:** Accepted.
**Context:** Trade-offs documented in §2.1.
**Decision:** Hybrid; revisit at 3+ agents.

### ADR-G-05 — Impersonation token model: RFC 8693 actor claim, sessionStorage, 30-min TTL

**Status:** Accepted.
**Context:** Auditability and clear off-ramp dominate convenience.
**Decision:** As described in §2.3.

### ADR-G-06 — Status page: Statuspage.io paid tier

**Status:** Accepted.
**Context:** Independence from app infrastructure; cost is acceptable.
**Decision:** Statuspage.io; document Cachet self-hosted path if costs grow.

### ADR-G-07 — WhatsApp BSP: 360Dialog primary, Twilio fallback

**Status:** Accepted.
**Context:** MENA onboarding speed and per-message cost.
**Decision:** 360Dialog; Twilio integration kept warm in the support handbook.

### ADR-G-08 — Push provider: FCM (Android) + APNs (iOS) directly

**Status:** Accepted.
**Context:** Capacitor plugins are well-supported; OneSignal is rejected to avoid an extra vendor.
**Decision:** Direct FCM + APNs.

### ADR-G-09 — Apple Developer enrollment fallback: partner entity in Turkey

**Status:** Accepted with risk.
**Context:** Iraq-based Apple developer accounts are inconsistently approved.
**Decision:** Attempt Iraqi entity; if rejected, use partner entity in Turkey with a written rights-assignment agreement.

### ADR-G-10 — e-Fakhata signing: per-tenant PKCS#12 in Secret Manager, XAdES-BES

**Status:** Accepted.
**Context:** Per-tenant key isolation, rotation, MoF spec compliance.
**Decision:** As described in §4.2. Hardware Security Modules deferred until at least 50 tenants are on e-fakhata.
