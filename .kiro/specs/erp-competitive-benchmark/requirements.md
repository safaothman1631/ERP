# Requirements: ERP Competitive Benchmark (vs Market Leaders)

**Version:** 1.0  
**Status:** Authoritative strategy spec  
**Last updated:** 2026-05-25  
**Companion:** `design.md`, `tasks.md`

---

## Introduction

ئەم spec ـە **بەراوردی ڕاستگۆیانە**ی سیستەمی ERP ـی tenant (`C:/Users/SAFA/zoho`) لەگەڵ گەورەترین پێشبڕکێکارەکان دیاری دەکات:

| Vendor | Segment | Benchmark role |
|--------|---------|----------------|
| **Odoo Enterprise** | SMB all-in-one | Breadth + open ecosystem |
| **Zoho One / Zoho ERP** | SMB SaaS bundle | UX + price + integrations |
| **SAP Business One** | Mid-market | Manufacturing + compliance depth |
| **Microsoft Dynamics 365 BC** | Mid-market | Finance + Microsoft stack |
| **NetSuite** | Mid-market cloud | Multi-entity + SaaS metrics |
| **QuickBooks Enterprise** | Accounting ceiling | SMB entry competitor |
| **ERPNext** | Open-source ERP | Feature/$ economics |

**Positioning:** Multi-tenant ERP بۆ **Iraq / MENA SMB** — unified data model، Arabic/Kurdish/English، Iraq localization first.

**Evidence base:**
- `LAUNCH_DECISION.md` — production_core GO
- `MASTER_AUDIT_REPORTS/BASELINE_REPORT.md` — 585 pytest, ~2138 routes
- `MASTER_AUDIT_REPORTS/odoo-cross-cutting-2026-q2.md`
- `MASTER_AUDIT_REPORTS/_MASTER_ROADMAP_TO_100.md`
- Live codebase inventory (2026-05-25)

**Out of scope:** 100% Odoo parity (~3547 endpoints); full enterprise SAP replacement.

---

## Glossary

| Term | Meaning |
|------|---------|
| **production_core** | Certified launch scope: GL, AR/AP, inventory, POS, Iraq, RBAC |
| **Wave A–D** | Extended modules (helpdesk, verticals, AI) — mostly scaffold |
| **Scaffold** | API + page exist; business logic thin; not launch-ready |
| **Preview mode** | Integration works without live credentials (e-invoice, WhatsApp) |
| **Must-have** | Industry baseline — gap blocks serious SMB ERP sale |
| **Differentiator** | Competitive advantage vs Zoho/Odoo in MENA |
| **Score** | 0–5 maturity: 0=none, 1=skeleton, 2=partial, 3=functional, 4=production, 5=market-leading |

---

## Current State Summary (Honest)

### Overall maturity vs market (weighted SMB ERP)

| Dimension | Your score | Odoo | Zoho One | NetSuite | Notes |
|-----------|------------|------|----------|----------|-------|
| Core Finance (GL) | **4.0** | 4.5 | 4.0 | 5.0 | JE balance, period lock, aged reports ✅ |
| AR/AP | **4.0** | 4.5 | 4.5 | 5.0 | 3-way match, recurring ✅ |
| Inventory/WMS | **3.5** | 4.5 | 3.5 | 4.5 | Multi-warehouse, lots; WMS light |
| Manufacturing | **2.5** | 4.5 | 2.0* | 4.5 | BOM/MRP pages; depth vs Odoo gap |
| CRM/Sales | **3.0** | 4.0 | 4.5 | 4.5 | Pipeline OK; commissions/CPQ weak |
| HR/Payroll | **3.0** | 4.0 | 3.5 | 3.5 | Iraq payroll ✅; recruitment/appraisal scaffold |
| Projects | **2.5** | 4.0 | 4.0 | 4.5 | Gantt exists; PSA depth limited |
| POS/Retail | **3.5** | 4.0 | 3.0 | 4.0 | Terminal + sync tested; reports partial |
| E-commerce | **2.0** | 4.0 | 3.5 | 4.5 | Storefront scaffold |
| Reporting/BI | **3.0** | 4.0 | 4.0 | 5.0 | Standard reports; no self-service BI |
| Multi-entity | **2.0** | 4.0 | 2.0 | 5.0 | Nav exists; consolidation partial |
| RBAC/Audit | **4.0** | 4.5 | 3.5 | 5.0 | Hash chain, encryption, role UX ✅ |
| Workflow/Automation | **2.0** | 4.5 | 4.0 | 4.5 | Rules page; no universal engine |
| API/Integrations | **2.5** | 4.5 | 4.5 | 5.0 | v1 API 5 resources; webhooks partial |
| Mobile/Offline | **1.5** | 4.0 | 4.0 | 4.0 | Responsive web; no offline PWA |
| Iraq/MENA L10n | **3.5** | 2.0** | 2.5 | 2.5 | **Your moat** — preview until prod config |
| AI | **1.5** | 2.5 | 4.0 | 4.5 | Scaffold; OCR preview |
| Industry verticals | **1.5** | 4.0 | 3.0 | 4.0 | 16 presets; CRUD shells |
| Platform/SaaS ops | **4.0** | 3.0 | 3.5 | 4.5 | Super-admin console strong ✅ |
| UX/Glass/Role-adaptive | **4.5** | 3.5 | 4.0 | 3.5 | **Differentiator** vs ERPNext/Odoo |

\* Zoho One lacks native MRP; Zoho ERP (India 2026) closes gap.

**Weighted overall (SMB Iraq buyer lens): ~3.1 / 5.0** — strong core + platform; weak breadth depth + integrations + mobile.

---

## Requirement 1: Production Core Parity (P0 — Must not regress)

**User Story:** وەک کڕیارێکی عێراقی SMB، دەمەوێت GL، فاکتور، کۆگا، POS بە متمانە کار بکەن.

### Acceptance Criteria

1. THE system SHALL maintain `production_core` certification per `LAUNCH_DECISION.md`.
2. THE backend SHALL keep ≥580 pytest green on accounting, RBAC, module gate, POS sync.
3. WHEN invoice is posted, THE system SHALL create balanced journal entries (double-entry).
4. WHEN PO is received and bill approved, THE system SHALL support 3-way match path.
5. WHEN POS sale completes offline-sync, THE system SHALL enforce idempotent stock deduction.
6. THE Iraq payroll engine SHALL compute statutory deductions for configured rules.
7. IF a Wave A–D module is not production-ready, THEN nav SHALL show module gate or "preview" badge — not silent failure.

---

## Requirement 2: Configuration Gaps (Not Built — Must Configure)

**User Story:** وەک ops lead، دەمەوێت بزانم چی **کۆد هەیە** بەڵام **production credential** نییە.

### Acceptance Criteria

1. **E-Invoice (ITA Iraq):** WHEN `preview_mode=true` (default), THE system SHALL NOT claim production fiscal submission; admin SHALL configure portal URL, XSD bundle, credentials in settings.
2. **WhatsApp Business API:** WHEN no `api_token`, THE system SHALL use preview send queue — production requires Meta Business verification.
3. **Iraq Payments (FIB/Zain/Asia):** WHEN merchant keys absent, THE system SHALL use stub redirect URLs documented in runbook.
4. **Firebase/Firestore production:** THE system SHALL use Blaze plan with indexes; quota exhaustion SHALL degrade gracefully (existing resilience).
5. **FIELD_ENCRYPTION_KEY:** Production deploy SHALL require encryption key per `LAUNCH_DECISION.md`.
6. **Multi-org switching:** i18n marks "coming soon" — NOT configured; single org per session is current behavior.
7. THE settings admin SHALL see a **Integration Health** panel listing: configured / preview / missing per integration.

---

## Requirement 3: Critical Gaps vs Market Must-Haves

**User Story:** وەک product owner، دەمەوێت gap ـە kritikalەکان بدۆزمەوە کە ڕکابەری Zoho/Odoo دەگرن.

### Gap Register (Priority P0)

| ID | Gap | Market standard | Your state | Requirement |
|----|-----|-----------------|------------|-------------|
| G-01 | Universal Chatter on all records | Odoo mail.thread | Partial widget | Req 3.1 |
| G-02 | Universal Activities / follow-ups | Odoo activities | CRM-only | Req 3.2 |
| G-03 | Automated actions engine | Odoo Studio | Rules page only | Req 3.3 |
| G-04 | Outbound webhooks (tenant-managed) | All leaders | Partial dispatch | Req 3.4 |
| G-05 | Public REST API coverage | Zoho/Odoo hundreds | v1: 5 resources | Req 3.5 |
| G-06 | Email inbound threading | Odoo/BC | Missing | Req 3.6 |
| G-07 | Multi-entity consolidation | NetSuite OneWorld | Partial UI | Req 3.7 |
| G-08 | Native mobile offline | Odoo/Zoho apps | Web only | Req 3.8 |
| G-09 | Self-service BI / Analytics | Zoho Analytics | Basic reports | Req 3.9 |
| G-10 | Subscription lifecycle (MRR/dunning) | Zuora/Zoho Billing | Scaffold | Req 3.10 |

#### Req 3.1 — Universal Chatter
WHEN user views any production_core entity (invoice, bill, PO, item), THE record detail SHALL show ChatterWidget with notes, attachments, and audit-linked messages.

#### Req 3.2 — Universal Activities
WHEN user assigns a follow-up on any entity, THE activity SHALL appear in a cross-module "My Activities" view with due/overdue filters.

#### Req 3.3 — Automation Engine v1
THE system SHALL support trigger types: on_create, on_update, on_field_change, scheduled; action types: notify, webhook, field update, approval route — configurable per org without code deploy.

#### Req 3.4 — Tenant Webhooks
THE tenant admin SHALL configure outbound webhook URLs, secret, event subscriptions (invoice.paid, po.received, etc.) from Settings; delivery SHALL retry with HMAC signature.

#### Req 3.5 — Public API v1 Expansion
THE `/api/v1/` SHALL cover minimum: contacts, items, invoices, bills, purchase_orders, sales_orders, payments, inventory_moves, accounts, journals (10 resource groups) with cursor pagination and OpenAPI docs.

#### Req 3.6 — Email Integration
THE system SHALL support SMTP outbound + inbound catch-all alias storing Message-ID threading on entity records.

#### Req 3.7 — Multi-Entity v1
WHEN org has multiple legal entities, THE user SHALL switch entity context; inter-company JE rules SHALL post elimination entries (basic).

#### Req 3.8 — Mobile PWA
THE POS and field sales flows SHALL work offline with sync queue; installable PWA manifest SHALL exist.

#### Req 3.9 — Embedded Analytics
THE dashboard SHALL support saved custom reports (drag dimensions) without separate BI SKU.

#### Req 3.10 — Subscriptions
WHEN subscription is active, THE system SHALL auto-generate recurring invoices, dunning emails, and MRR dashboard metric.

---

## Requirement 4: Wave Module Honesty (P1 — Label & Gate)

**User Story:** وەک user، نابێت بڕۆم بۆ module ـێک و blank/crash ببینم.

### Acceptance Criteria

1. WHEN module maturity < functional (score ≤2), THE nav leaf SHALL show badge: `Preview` or `Beta`.
2. WHEN user opens scaffold page, THE page SHALL render `ComingSoon` or `PreviewSection` — never blank white screen.
3. THE platform admin SHALL set module maturity tier in license editor: `production | beta | preview | hidden`.
4. THE demo org SHALL enable only `production_core` modules by default — Wave modules opt-in.
5. THE documentation SHALL publish module maturity matrix in `docs/ux/MODULE_MATURITY.md`.

---

## Requirement 5: Iraq/MENA Differentiators (P0 — Double Down)

**User Story:** وەک Iraqi SMB، دەمەوێت ERP ـێک کە Zoho/Odoo بە partner نadenasin.

### Acceptance Criteria

1. THE system SHALL ship **Iraq-first** chart of accounts, WHT/VAT rules, fiscal calendar presets (`l10n_iq`).
2. THE UI SHALL support **ku + ar + en** with RTL on all launch-critical flows (already required — verify coverage ≥95% on production_core).
3. THE e-invoice flow SHALL reach production ITA submission when credentials configured (exit preview).
4. THE payroll SHALL export payslip formats acceptable to Iraqi/KRI employers (PDF + statutory summary).
5. THE pricing model SHALL support IQD primary + USD secondary with revaluation (existing — document for sales).
6. WHEN compared to Zoho GCC pack, THE system SHALL document Iraq-specific advantages in product marketing truthfully (no fake certifications).

---

## Requirement 6: Competitive Scorecard Maintenance

**User Story:** وەک leadership، دەمەوێت scorecard ـێک هەبێت کە هەر چارەک ساڵ نوێ بکرێتەوە.

### Acceptance Criteria

1. THE repo SHALL maintain `docs/strategy/COMPETITIVE_SCORECARD.md` synced with this spec.
2. WHEN a module reaches new maturity tier, THE scorecard SHALL update within same sprint.
3. THE quarterly review SHALL compare: feature count, test coverage, NPS proxy (support tickets), win/loss vs Odoo/Zoho (manual input).

---

## Requirement 7: What You Should NOT Build (Anti-Requirements)

1. THE system SHALL NOT pursue 100% Odoo endpoint parity (~3547) before production_core customers are live.
2. THE system SHALL NOT ship EMR-grade healthcare before hospital customers signed.
3. THE system SHALL NOT duplicate Zoho's 45-app strategy — unified data model is the moat.
4. THE system SHALL NOT add AI copilot before automation engine + API coverage (foundation first).
5. THE system SHALL NOT expose Wave scaffold modules in default onboarding for new tenants.

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-1 | Competitive benchmark doc readable by non-engineers (Kurdish executive summary) |
| NFR-2 | Gap IDs (G-01…) traceable to tasks in `tasks.md` |
| NFR-3 | Honest "scaffold" labeling — no marketing overclaim |
| NFR-4 | TCO target: <$30/user/mo for full_core bundle at 50 users (strategy) |

---

## Executive Summary (کوردی)

**چیت باشە:**
- قازانج: finance core، RBAC/audit، platform console، role-adaptive UX، Iraq focus
- لە Zoho/Odoo باشتر: unified tenant UX، glass UI، vendor/platform split، demo multi-role

**چیت خراپە / کەمە:**
- قەبارەی module زۆرە بەڵام ~70% scaffold — nav درێژترە لە capability
- API عمومی، webhooks، automation، chatter universal — لە Odoo/Zoho دواتر
- mobile offline، BI self-service، multi-entity consolidation — نییە یان partial
- verticals (healthcare, construction…) — demo-only

**چیت کۆنفیگ نەکراوە:**
- e-invoice production، WhatsApp token، payment gateways، multi-org switch

**پێشنیاری ستراتیژی:**
1. **Launch production_core** — مەچۆ بۆ 100% Odoo
2. **90 ڕۆژ:** G-04, G-05, G-01, Integration Health panel
3. **6 مانگ:** G-03 automation, G-10 subscriptions, G-07 multi-entity v1
4. **12 مانگ:** Wave A P0 modules (helpdesk, field service) بە maturity gates
