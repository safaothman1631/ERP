# Growth-to-100 Spec — Delivery Summary

> **Spec ID:** `growth-to-100` (Tier 2 — Growth blockers between first paying customer and 100 paying customers)
> **Author:** Senior Product/Engineering Specifications Architect
> **Date:** 2026-05-29

---

## Files delivered

| Path | Words (approx.) |
|------|----------------:|
| `.kiro/specs/growth-to-100/requirements.md` | ~5,700 |
| `.kiro/specs/growth-to-100/design.md` | ~5,200 |
| `.kiro/specs/growth-to-100/tasks.md` | ~5,300 |
| `_deltas/growth-to-100-spec-summary.md` | this file |
| **Total** | **~16,200 words** |

All three primary files exceed the 5,000-word target. Total exceeds the 15,000-word target.

---

## What the spec covers

The spec addresses the five Tier-2 growth blockers as five Requirement groups, written in EARS format with sub-numbered identifiers:

1. **R1 — Marketing & Discovery** (15 sub-requirements): Astro + Vercel marketing site, trilingual landing/pricing/docs, 10 SEO blog post outlines for Iraqi audience, contact form to CRM, newsletter double opt-in, A/B testing via Vercel Edge, Plausible + GA4 analytics, OG/JSON-LD structured data, Lighthouse CI gate, cookie consent.
2. **R2 — Customer Support Excellence** (15 sub-requirements): Crisp + Notion KB hybrid, 40 KB articles in 3 languages, admin impersonation with RFC 8693 actor claim and 30-min read-only token, hotfix per-tenant feature flag, Statuspage.io with synthetic probes, in-app help widget, email + WhatsApp (360Dialog) routing, 30 saved replies, 14-day onboarding drip, NPS at 30/90/180 days.
3. **R3 — Hardware Compatibility Matrix** (15 sub-requirements): real Iraqi-market devices named (Epson TM-T20III, Xprinter XP-T80A, Bixolon SRP-330II, generic 58mm BT, 2026 newest), ESC/POS adapter pattern, dialect detection probe + generic fallback, cash-drawer pin matrix (pin-5 vs pin-2), HID + camera barcode paths, three customer-display paths (LCD pole, tablet PWA, smart TV PWA), 58mm + 80mm receipt templates, hardware pairing wizard, vendor partnership program for shopkeeper kits.
4. **R4 — Iraq Compliance Production Grade** (18 sub-requirements): full e-fakhata XML schema with version registry, per-tenant PKCS#12 keystore in Secret Manager, XAdES-BES signing, queued submission with retries, VAT-registered vs not, withholding tax rules (3% services / 5% rent / 2% contracts), annual income-tax flat-rate, customs invoice variant, Arabic-Indic digit toggle, IQD currency formatting with "د.ع" suffix, IQD cash-drawer denomination breakdown (250–50000), Hijri date toggle, Arabic PDF typesetting with Noto Naskh/Amiri, MoF API integration, CBI rate auto-fetch, tax auditor export, native-speaker QA gate.
5. **R5 — Mobile Distribution Excellence** (16 sub-requirements): Play Console + App Store enrollment with partner-entity fallback for Apple, AAB signing via Google Play App Signing, iOS provisioning via Fastlane Match, trilingual store listings with real-device screenshots, FCM + APNs push with topic registration, in-app force-update gate, beta testing via Internal Testing + TestFlight, Firebase Test Lab pre-launch report on top-12 Iraqi device pool, Crashlytics with ≥ 99.5% gate, ASO research (Kurdish + Arabic + English keywords), sanctions risk documentation.

The design document elaborates each section with concrete stack choices, code snippets (XML schema, TypeScript signatures, JSON token claim shapes), trade-off discussions, and an ADR section with 10 architecture decisions.

The tasks document breaks execution into 5 phases (G1–G5) with 20 + 15 + 20 + 30 + 25 = 110 tasks plus 5 cross-cutting items, a 15-entry risk register, and 16 success metrics with targets at 30 days and 100 customers.

---

## Top-5 risks (Iraq-market-specific)

These are surfaced from the spec's risk register (`tasks.md`) and ranked by combined likelihood + impact relative to the Iraqi context.

### 1. MoF e-fakhata API access denied or delayed for tenants (R-G-02)
**Why this matters:** The mandate is real but uneven in enforcement; some tenants will be granted access easily, others may face long delays or rejections. If access is denied at the customer level, our submission pipeline cannot complete, and the customer faces compliance exposure. Mitigation: maintain the "generate + sign but do not submit" path so the customer can hand-upload to the MoF portal, and document the operator's manual workflow.

### 2. Apple Developer Program rejects Iraqi entity enrollment (R-G-03)
**Why this matters:** Apple's regional policy for Iraq-based legal entities is inconsistent. Rejection could delay iOS launch by months. Mitigation: pre-arrange a partner entity in Turkey or Jordan with a written rights-assignment agreement, so we can pivot within days rather than months. This adds cross-border tax + legal complexity that needs counsel on retainer.

### 3. FCM degraded in some Iraqi networks (R-G-04)
**Why this matters:** Some Iraqi ISPs and corporate networks block or degrade Google services unpredictably. If push doesn't deliver, the user misses critical alerts (incoming order, invoice paid). Mitigation: in-app WebSocket long-poll fallback opens automatically when delivery rate per tenant drops below 80%, and the UI shows a "Push delivery limited — using fallback" banner.

### 4. Hardware unavailable or import-restricted in Iraq (R-G-05)
**Why this matters:** The hardware compatibility matrix is meaningless if the customer cannot buy the supported devices locally. Some printers and scanners arrive in Iraq via grey-market channels with random firmware. Mitigation: 2 hardware-distributor partnerships, kit-bundle program, accept "known-working revision" + "unknown firmware fallback" rows in the matrix.

### 5. Founder bandwidth exhausted in support and sales simultaneously (R-G-15)
**Why this matters:** The 1-to-100 journey requires the founder to be in marketing, sales, support, hiring, and product simultaneously. This burns out a single human at roughly 30–40 customers. Mitigation: codify saved replies, fully wire onboarding drip to deflect early questions, hire one support agent at 25 paying customers — even part-time. Track founder hours per customer weekly.

---

## Cross-references

| This spec | References |
|-----------|------------|
| R1 (Marketing) | Tier 1 `world-class-performance` for app-side LCP standards; `landing-auth-vercel-redesign` for adjacent auth landing work. |
| R2 (Support) | `super-admin-console` for the existing super-admin shell where impersonation will plug in; `module-licensing-access` for the per-tenant flag plumbing. |
| R3 (Hardware) | `phase-4-pos-iraq` for the existing POS foundation; `world-class-performance` §4 for POS performance budget that hardware paths must meet. |
| R4 (Compliance) | `phase-4-pos-iraq` and the existing `/l10n-iq`, `/einvoice` modules; `database-foundation-excellence` for the data model alignment. |
| R5 (Mobile) | `mobile-first-responsive-overhaul` for the web responsive baseline that the Capacitor wrapper inherits; `phase-5-platform-devops` for CI/CD foundation. |
| Cross-cutting | `system-wide-ux-overhaul` for design tokens shared with marketing site; `settings-documentation` for the docs structure pattern. |

---

## Open questions

1. **MoF spec version cadence.** Is the e-fakhata XSD versioned and published, or do we need a Ministry contact to track changes? Affects T-G.4.1, T-G.4.2.
2. **Apple Developer Program eligibility from Iraq in 2026.** Has Apple's policy shifted? A live test of enrollment is the only definitive answer. Affects T-G.5.2 timing.
3. **Statuspage.io pricing tier in Iraq.** Atlassian's pricing across regions varies; we may qualify for an emerging-markets discount. Affects ADR-G-06.
4. **Hardware partner candidates.** Who are the 3 distributors we will approach? The spec calls for outreach but doesn't name them — a 1-week founder research task is implied before T-G.3.19.
5. **WHT rates by category — authoritative reference.** The 3%/5%/2% numbers are commonly quoted but the canonical MoF circular reference is needed before T-G.4.13 ships to production.
6. **CBI rate publication format.** Is there a documented API or only a web page? If a web page, what is the parsing risk? Affects T-G.4.22 resilience.
7. **Iraqi market device pool for Test Lab.** The illustrative top-12 list in design §5.6 was assembled from general market knowledge; Q1 2026 ground-truth research should refresh it before T-G.5.16.
8. **Partner entity for Apple enrollment.** Turkey vs Jordan — which has the simpler rights-assignment legal pattern? Counsel needs to advise before T-G.5.2 falls back.
9. **WhatsApp Business policy for Iraq operators in 2026.** 360Dialog and Twilio have different onboarding latencies; both should be in motion in parallel to avoid blocking T-G.2.11.
10. **e-fakhata mandate enforcement timeline.** Which tenants are required to be on it in 2026 vs 2027 vs 2028? Affects how aggressively we pitch compliance in the marketing site (R1).

---

## Format conformance

- **EARS format:** every Requirement sub-clause uses "THE … SHALL …" or "WHEN … THE … SHALL …".
- **IDs:** Requirements R1.1–R5.16, NFR-G1–NFR-G20, Design ADR-G-01–ADR-G-10, Tasks T-G.1.1–T-G.5.25 + T-G.X.1–T-G.X.5, Risks R-G-01–R-G-15.
- **Iraq-specific grounding:** every section names real devices (Epson TM-T20III, Bixolon SRP-330II), real APIs (MoF, CBI, FCM, APNs), real currency denominations (250 / 500 / 1000 / 5000 / 10000 / 25000 / 50000 IQD), real tax categories (WHT 3% services / 5% rent / 2% contracts), real distribution risks (Apple Developer Program regional policy, FCM availability under sanctions risk).
- **Honest effort estimates:** mobile review wait time is 4 weeks calendar, Apple enrollment is "1–3 weeks elapsed (uncertain)", MoF sandbox round-trip is 3 days, hardware procurement is 1 week shipping.
- **Acceptance is binary at 100 paying customers** on all six gates simultaneously.

End of summary.
