# 🧠 BRAIN MASTER EXECUTION PLAN — Q2 2026

**Date:** 2026-05-03
**Orchestrator:** Shadow Brain
**Mandate:** Full-project audit → gap closure → professional implementation
**Source reports:** `Explore` audit, `ERP Odoo Researcher` Odoo-19 gap, `زۆهۆ ریسێرچەر` Zoho-Books gap

---

## 1. CURRENT STATE (verified)

| Metric | Value |
|--------|-------|
| Backend routers | 97 (`backend/app/api/`) |
| Backend repos | 35 (`backend/app/firestore/`) |
| Backend services | 24 (`backend/app/services/`) |
| Backend endpoints | ~850 |
| Frontend pages | 80+ (`frontend/src/pages/`) |
| Locale keys | 2000+ per language |
| Tests | 16 phase tests + smoke runner |
| `.env` + `serviceAccountKey.json` | ✅ present |

**Strong / production-ready:** Accounting, Invoicing, Expenses, Sales, Purchase, Inventory core, POS (110 ep / 18 pages), CRM core, HR, Payroll, Manufacturing backend, Iraq L10n, RBAC, Audit, Multi-company, WhatsApp, OCR, Reports.

---

## 2. CONSOLIDATED GAP MATRIX (synthesized from 3 reports)

### 🔴 P0 — Parity-critical (real user-facing gaps)
| # | Gap | Layer | Wave |
|---|-----|-------|------|
| 1 | Wave-A frontend pages (helpdesk, field_service, subscriptions, documents, knowledge, quality, maintenance, plm, repairs, hr_extended, studio) — backends exist, **UI missing** | Frontend | A |
| 2 | Universal attachments UI component (attach files to any record) | Both | A |
| 3 | Customer statements generator + page + email | Both | B |
| 4 | Email templates per document type (Quote/Invoice/SO/PO) + UI | Both | B |
| 5 | Workflow automation rules UI (`/automation` exists in backend) | Frontend | A |
| 6 | Audit Log UI viewer with filters | Frontend | A |
| 7 | Project Gantt chart + dependencies | Both | C |
| 8 | Customer portal (read-only invoices + pay link) | Both | C |
| 9 | Manufacturing UI polish (already 3 pages — verify completeness) | Frontend | C |
| 10 | Saved filters / column customization (table-level) | Frontend | D |

### 🟡 P1 — High-value
| # | Gap | Layer | Wave |
|---|-----|-------|------|
| 11 | Analytic / cost-center accounting | Both | B |
| 12 | Budget management (set + variance vs actual) | Both | B |
| 13 | Cashflow forecast (30/60/90) | Both | B |
| 14 | CRM: sales teams + lead assignment rules + lead scoring config | Both | A |
| 15 | Inventory: bin/location, putaway/removal strategies, cycle counts | Both | C |
| 16 | Marketing automation flows + campaigns UI | Both | C |
| 17 | E-commerce storefront (cart + checkout + customer accounts) | Both | C |
| 18 | Subscription billing engine + UI | Both | C |
| 19 | Documents + e-signature workflow | Both | A |
| 20 | Sales/vendor returns refund workflow | Both | A |
| 21 | Numbering schemas per branch | Backend | D |

### 🟢 P2 — Nice-to-have
Custom report builder, dashboard widget builder, branding kits, scheduled reports, GraphQL, Zapier — deferred.

---

## 3. WAVE EXECUTION PLAN

Four parallel-friendly waves, each delegated to ERP specialist agents. Each wave has a checker pass.

### Wave A — UX surface for existing backends (highest ROI)
**Owner agents:** زۆهۆ فرۆنتئێند + ERP UX Designer + ERP CRM
**Deliverables:**
- 11 minimal CRUD pages for Wave-A backends (helpdesk, field_service, subscriptions, documents, knowledge, quality, maintenance, plm, repairs, hr_extended, studio) + lazy routes in `App.tsx` + menu entries in `AppLayout.tsx` + i18n keys
- Universal `<Attachments>` component using `/api/attachments` + integrate into Invoice/Bill/Contact/Project detail pages
- `/automation/rules` page (CRUD over existing automation backend)
- `/audit-log` viewer page with filters (entity, user, action, date range)
- CRM additions: Sales Teams page + Lead Assignment Rules page; backend extensions if needed

### Wave B — Accounting power features
**Owner agents:** زۆهۆ ئەکاونتینگ + زۆهۆ باکئێند + ERP UX Designer
**Deliverables:**
- Backend: `analytic.py` router + repo + service (analytic accounts + lines + distribution per JE)
- Backend: `budgets.py` router + repo (budgets per account+period, variance calc)
- Backend: `cashflow_forecast.py` (sum future invoices/bills + current cash → 30/60/90)
- Backend: `customer_statements.py` (generator + email send)
- Backend: `email_templates.py` (CRUD + render with variables)
- Frontend pages for each + i18n
- Wire register in `main.py`

### Wave C — Operational power
**Owner agents:** ERP Inventory + ERP Project + ERP E-commerce + ERP POS
**Deliverables:**
- Inventory: bin/location hierarchy backend + UI; putaway rules; cycle counts
- Project: Gantt page (Frappe Gantt or simple custom) + dependencies CRUD
- E-commerce minimal storefront route (`/store`) — product list + cart drawer + checkout (uses existing `ecommerce.py`)
- Subscriptions UI (CRUD + status + renew)

### Wave D — Polish + verticals + DevOps
**Owner agents:** ERP UX Designer + ERP DevOps + ERP Localization Iraq
**Deliverables:**
- Saved filters + column customization in core tables (Invoices/Bills/Contacts)
- Per-branch numbering schemas backend + UI
- Vertical-industry hub pages (each routes to existing module backends): minimum landing pages for hospital, hotel, restaurant, education, construction, logistics, real_estate, agriculture, ngo, government — listed in `ModuleHub.tsx`
- Verify CI/CD GitHub Actions workflow + production Dockerfile

---

## 4. VERIFICATION GATES (must all pass before final report)

1. `npm run build` (frontend) — 0 errors, 0 warnings on TS
2. `python test_all.py` (backend) — all phase tests pass / no regressions
3. Backend boots cleanly with `start-backend.ps1`
4. agentshield scan clean (no new secrets / OWASP issues)
5. Every new page has KU + EN locale keys
6. Every new backend endpoint registered in `main.py`

---

## 5. NOT-IN-SCOPE this sprint (deferred)

- Bank feeds (requires external API contracts)
- Telephony integration
- Native mobile apps
- ML lead scoring training
- Custom report builder
- Full e-signature legal flow
- 12 vertical-industry deep verticals (only hub landing pages this round)

---

**Approved by Brain. Dispatching waves now.**
