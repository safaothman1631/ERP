# Competitive Scorecard — Zoho ERP vs Market Leaders

**Last updated:** 2026-05-26  
**Spec:** [`.kiro/specs/erp-competitive-benchmark/`](../.kiro/specs/erp-competitive-benchmark/)  
**Method:** 0–5 scale (0=none, 5=market-leading); evidence from codebase + `LAUNCH_DECISION.md`

---

## Overall

| Metric | Score |
|--------|-------|
| **Weighted overall (Iraq SMB lens)** | **3.2 / 5.0** |
| production_core readiness | **4.0 / 5.0** |
| Platform breadth (nav routes) | **4.5 / 5.0** (nav only) |
| Platform depth (business logic) | **2.4 / 5.0** (Wave modules) |

---

## Dimension scores

| Dimension | You | Odoo | Zoho One | NetSuite | ERPNext |
|-----------|-----|------|----------|----------|---------|
| Core Finance (GL) | 4.0 | 4.5 | 4.0 | 5.0 | 4.0 |
| AR/AP | 4.0 | 4.5 | 4.5 | 5.0 | 4.0 |
| Inventory/WMS | 3.5 | 4.5 | 3.5 | 4.5 | 4.0 |
| Manufacturing | 2.5 | 4.5 | 2.0 | 4.5 | 4.0 |
| CRM/Sales | 3.0 | 4.0 | 4.5 | 4.5 | 3.0 |
| HR/Payroll | 3.0 | 4.0 | 3.5 | 3.5 | 3.5 |
| Projects | 2.5 | 4.0 | 4.0 | 4.5 | 3.5 |
| POS/Retail | 3.5 | 4.0 | 3.0 | 4.0 | 2.0 |
| E-commerce | 2.5 | 4.0 | 3.5 | 4.5 | 2.0 |
| Reporting/BI | 3.2 | 4.0 | 4.0 | 5.0 | 2.5 |
| Multi-entity | 2.5 | 4.0 | 2.0 | 5.0 | 4.0 |
| RBAC/Audit | 4.0 | 4.5 | 3.5 | 5.0 | 3.0 |
| Workflow/Automation | 2.0 | 4.5 | 4.0 | 4.5 | 2.5 |
| API/Integrations | 2.5 | 4.5 | 4.5 | 5.0 | 4.0 |
| Mobile/Offline | 2.0 | 4.0 | 4.0 | 4.0 | 3.5 |
| **Iraq/MENA L10n** | **3.5** | 2.0 | 2.5 | 2.5 | 2.0 |
| AI | 1.5 | 2.5 | 4.0 | 4.5 | 1.5 |
| Industry verticals | 1.8 | 4.0 | 3.0 | 4.0 | 2.5 |
| Platform/SaaS ops | 4.0 | 3.0 | 3.5 | 4.5 | 2.0 |
| UX (role-adaptive) | 4.5 | 3.5 | 4.0 | 3.5 | 2.5 |

---

## Phase 5 partial notes (2026-05-26)

| Initiative | Status | Score impact |
|------------|--------|--------------|
| **Subscriptions + dunning** | Plans, MRR reports, pause/cancel, dunning queue | E-commerce **2.0 → 2.5** |
| **Multi-entity v1** | Companies, IC, consolidated P&L/BS, eliminations pages | Multi-entity **2.0 → 2.5** |
| **PWA offline (partial)** | `sw.js` app-shell cache; POS sync queue scaffold | Mobile/Offline **1.5 → 2.0** |
| **Embedded analytics v1** | Custom report builder + `/reports/analytics` dashboard | Reporting/BI **3.0 → 3.2** |
| **Restaurant KDS** | Kitchen display + menu/tables; tier-3 functional | Industry verticals **1.5 → 1.8** |

---

## Where you win

1. **Iraq-first localization** — no global vendor ships native Iraq pack OOTB
2. **Unified tenant UX** — one app vs Zoho 45-app bundle sync issues
3. **Security** — audit hash chain, field encryption, RBAC test coverage
4. **Platform console** — licensing, impersonation, module requests (vendor-grade)
5. **Role-adaptive glass UX** — ahead of ERPNext/Odoo default UI

---

## Where you lose (sale blockers)

1. **API v1** — 10 resources vs hundreds (integrations/partners)
2. **Webhooks** — partial vs tenant-managed catalog
3. **Automation** — no universal engine (Odoo Studio class)
4. **Chatter/Activities** — not universal on all records
5. **Mobile offline** — PWA shell only; full POS offline sync incomplete
6. **Nav oversell** — ~120 routes, many scaffold (trust risk)

---

## Configuration (not missing code)

| Integration | Status |
|-------------|--------|
| E-invoice ITA | Preview — needs production credentials |
| WhatsApp | Preview — needs Meta token |
| FIB/Zain payments | Stub — needs merchant keys |
| Multi-org switch | Partial — consolidation pages live; TopBar selector pending |

---

## Targets

| Horizon | Target score | Key moves |
|---------|--------------|-----------|
| 90 days | 3.4 | Webhooks, API v1×10, integration health, chatter on core entities |
| 6 months | 3.6 | Automation v1, subscriptions depth, multi-entity TopBar, PWA POS sync |
| 12 months | 3.8 | 2 verticals depth + Wave A P0 modules with paying customers |

---

## Review cadence

- Update this file when a module changes tier (see `docs/ux/MODULE_MATURITY.md`)
- Quarterly: re-score vs Odoo/Zoho release notes
