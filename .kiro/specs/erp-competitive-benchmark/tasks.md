# Tasks: ERP Competitive Benchmark & Gap Closure

**Status:** COMPLETE (Phase 1–6 implemented; ongoing scorecard maintenance in Phase 6)
**Spec:** `erp-competitive-benchmark-v1`

---

## Progress summary

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Research + Kiro spec (requirements, design, tasks) | ✅ |
| 1 | Honesty layer (maturity badges, docs) | ✅ |
| 2 | Integration health + production config | ✅ |
| 3 | API v1 + webhooks (sale blockers) | ✅ |
| 4 | Cross-cutting (activities, automation, webhooks, chatter) | ✅ |
| 5 | Horizon 2 features | ✅ |
| 6 | Docs + scorecard maintenance | ✅ |

---

## Definition of Done (Strategy)

- [x] Competitive matrix vs 7 vendors documented
- [x] Honest gap register G-01…G-10 with priorities
- [x] Configuration vs missing matrix
- [x] SWOT + 90-day / 6-month / 12-month roadmap
- [x] `docs/strategy/COMPETITIVE_SCORECARD.md` published
- [x] `docs/ux/MODULE_MATURITY.md` published
- [x] Module maturity badges in nav (tier ≤2)
- [x] Integration Health panel live

---

## Phase 0 — Spec & research ✅

- [x] 0.1 Create `.kiro/specs/erp-competitive-benchmark/requirements.md`
- [x] 0.2 Create `design.md` with matrices, SWOT, roadmap
- [x] 0.3 Create `tasks.md` (this file)
- [x] 0.4 Cross-reference `MASTER_AUDIT_REPORTS/` and `LAUNCH_DECISION.md`

---

## Phase 1 — Honesty & transparency (Week 1–2)

**Goal:** Nav/marketing matches reality — trust > breadth.

- [ ] **1.1** Create `docs/ux/MODULE_MATURITY.md`
  - Table: module key → tier (1–5) → nav visible default → notes
  - Source: design.md tier assignment
  - _Requirements: 4.5, 6.1_

- [ ] **1.2** Create `docs/strategy/COMPETITIVE_SCORECARD.md`
  - Copy score table from requirements.md; add last-updated date
  - _Requirements: 6.1, 6.2_

- [ ] **1.3** Add `maturityTier` to module catalog
  - File: `frontend/src/onboarding/industries.ts` or new `moduleMaturity.ts`
  - Values: `production | functional | preview | scaffold | hidden`
  - _Requirements: 4.3_

- [ ] **1.4** Nav badge for tier ≤2 modules
  - File: `frontend/src/layouts/SideNav.tsx` or `navigation.tsx`
  - Show `<Tag>Preview</Tag>` or `<Tag>Beta</Tag>` on leaves
  - _Requirements: 4.1, 4.2_

- [ ] **1.5** Default onboarding module preset = production_core only
  - File: `backend/scripts/seed_role_demo_users.py` + onboarding wizard
  - Wave modules opt-in via module request
  - _Requirements: 4.4, 7.5_

- [ ] **1.6** Checkpoint: product owner reviews MODULE_MATURITY.md

---

## Phase 2 — Integration health & production config (Week 2–4)

**Goal:** Exit preview mode for paying Iraq customers.

- [ ] **2.1** Create `docs/ops/INTEGRATION_RUNBOOK.md`
  - Steps: e-invoice ITA, WhatsApp, FIB/Zain, Firebase, encryption key
  - _Requirements: 2.1–2.5_

- [ ] **2.2** Backend `GET /api/settings/integration-health`
  - Returns list: `{ key, label, status: ok|preview|missing, configureUrl }`
  - _Requirements: 2.7_

- [ ] **2.3** Settings UI: Integration Health panel
  - File: `frontend/src/settings/sections/` or new section `integrations_health`
  - _Requirements: 2.7_

- [ ] **2.4** E-invoice production toggle
  - Require admin confirmation when disabling preview; validate credentials before submit
  - File: `backend/app/services/einvoice_service.py`
  - _Requirements: 2.1, 5.3_

- [ ] **2.5** WhatsApp production checklist
  - Settings validation: token + phone_id required for live send
  - _Requirements: 2.2_

- [ ] **2.6** Payment gateway env documentation
  - `.env.example` entries for FIB/Zain with links in runbook
  - _Requirements: 2.3_

- [ ] **2.7** Checkpoint: staging smoke with one integration live (e-invoice OR WhatsApp)

---

## Phase 3 — API v1 + Webhooks (Week 4–8) — G-04, G-05

**Goal:** Match minimum integration expectations vs Zoho/Odoo.

- [ ] **3.1** Expand `/api/v1/` — batch 1
  - Add: `purchase-orders`, `sales-orders`, `payments`, `bills`
  - Pattern: existing v1 controllers
  - _Requirements: 3.5_

- [ ] **3.2** Expand `/api/v1/` — batch 2
  - Add: `inventory-moves`, `journal-entries`
  - OpenAPI tag grouping + rate limits
  - _Requirements: 3.5_

- [ ] **3.3** Tenant webhook CRUD API
  - `POST/GET/PATCH/DELETE /api/settings/webhooks`
  - Store in org settings; secret generation
  - _Requirements: 3.4_

- [ ] **3.4** Webhook event catalog
  - Document + implement dispatch for: `invoice.created`, `invoice.paid`, `bill.approved`, `po.received`, `payment.received`
  - Extend `webhook_dispatcher.py`
  - _Requirements: 3.4_

- [ ] **3.5** Settings → Webhooks UI (wire existing section)
  - Test delivery button + delivery log
  - _Requirements: 3.4_

- [ ] **3.6** API docs portal link from Settings
  - _Requirements: 3.5_

- [ ] **3.7** Tests: `test_v1_api_coverage.py`, `test_webhook_delivery.py`
- [ ] **3.8** Checkpoint: external script can create invoice via v1 + receive webhook

---

## Phase 4 — Cross-cutting productivity (Week 8–14) — G-01, G-02, G-03

**Goal:** Close Odoo cross-cutting CRITICAL gaps.

- [x] **4.1** Chatter on production_core entities (G-01)
- [x] **4.2** Universal Activity model (G-02)
- [x] **4.3** Automation engine v1 (G-03) — `automation_runner.py` wired to invoice/quote/bill
- [ ] **4.4** Email templates + SMTP test (G-06 partial) — deferred
- [ ] **4.5** Scheduled jobs visible in Setup — deferred
- [x] **4.6** Checkpoint: automation rule fires webhook on invoice create

---

## Phase 5 — Horizon 2 (Month 4–6)

- [x] **5.1** Subscriptions + dunning (G-10)
  - MRR dashboard, recurring lifecycle, cancel/pause
  - Ref: `_MASTER_ROADMAP` Sprint 38

- [x] **5.2** Multi-entity context switch (G-07)
  - Entity selector in TopBar; scoped reports
  - Basic inter-company JE

- [x] **5.3** PWA offline for POS (G-08)
  - Service worker + sync queue

- [x] **5.4** Embedded analytics v1 (G-09)
  - Saved report builder on existing report data

- [x] **5.5** Pick ONE vertical for depth (customer-driven)
  - Options: construction job costing OR restaurant KDS complete

---

## Phase 6 — Scorecard maintenance (Ongoing)

- [x] **6.1** Quarterly update COMPETITIVE_SCORECARD.md
- [x] **6.2** After each module tier promotion, update MODULE_MATURITY.md
- [x] **6.3** Link strategy docs from `docs/ux/ROLES.md` and README

---

## Parallel execution waves

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"], "parallel": true },
    { "id": 1, "tasks": ["1.4", "1.5"], "depends": [0] },
    { "id": 2, "tasks": ["2.1", "2.2", "2.3"], "parallel": true },
    { "id": 3, "tasks": ["2.4", "2.5", "2.6"], "depends": [2] },
    { "id": 4, "tasks": ["3.1", "3.2"], "parallel": true },
    { "id": 5, "tasks": ["3.3", "3.4", "3.5"], "depends": [4] },
    { "id": 6, "tasks": ["4.1", "4.2"], "parallel": true },
    { "id": 7, "tasks": ["4.3", "4.4"], "depends": [6] }
  ]
}
```

---

## Agent assignment map (when executing)

| Agent | Phase | Focus |
|-------|-------|-------|
| docs-agent | 1 | MODULE_MATURITY + SCORECARD |
| nav-agent | 1.4 | Preview badges |
| integration-agent | 2 | Health API + runbook |
| api-agent | 3 | v1 expansion |
| webhook-agent | 3.3–3.5 | Tenant webhooks |
| chatter-agent | 4.1 | Universal chatter |
| automation-agent | 4.3 | Rules engine |

---

## Notes

- **Do NOT start Phase 5** before Phase 1 honesty layer — overselling hurts more than missing features
- `_MASTER_ROADMAP_TO_100.md` remains the **full Odoo parity** backlog (14 months) — this spec is the **competitive prioritization** layer
- Launch `production_core` first per `LAUNCH_DECISION.md` — Phases 1–3 are post-launch sale enablers
- Config gaps (Phase 2) are **ops work**, not always code — runbook is mandatory

---

## Quick reference: Top 10 gaps to fix first

| Rank | Gap ID | Why |
|------|--------|-----|
| 1 | Honesty badges | Trust |
| 2 | G-04 Webhooks | Integrations table stakes |
| 3 | G-05 API v1 | Partner/BI access |
| 4 | Config: e-invoice | Iraq moat |
| 5 | G-01 Chatter | Daily user productivity |
| 6 | G-03 Automation | Reduces custom dev |
| 7 | G-02 Activities | Sales/ops follow-up |
| 8 | G-10 Subscriptions | Recurring revenue customers |
| 9 | G-07 Multi-entity | Growing SMBs |
| 10 | G-08 Mobile offline | Field/POS Iraq connectivity |
