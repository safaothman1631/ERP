# Module Maturity Matrix

**Last updated:** 2026-05-26  
**Spec:** [`.kiro/specs/erp-competitive-benchmark/`](../../.kiro/specs/erp-competitive-benchmark/)

## Tier legend

| Tier | Label | Nav default | Meaning |
|------|-------|-------------|---------|
| **5** | Market | Show | Best-in-class depth |
| **4** | Production | Show | Launch-certified (`production_core`) |
| **3** | Functional | Show | Usable; known gaps |
| **2** | Preview | Show + badge | Integration or UI preview |
| **1** | Scaffold | Hide default | API+page; thin logic |
| **0** | Hidden | Hide | Not ready |

---

## production_core (Tier 4)

| Module | Tier | Evidence |
|--------|------|----------|
| accounting / GL | 4 | JE balance tests, period lock |
| sales / AR | 4 | Invoices, quotes, SO, credit notes, recurring |
| purchase / AP | 4 | Bills, PO, 3-way match |
| inventory | 4 | Multi-warehouse, lots, transfers |
| pos | 4 | Terminal, sync idempotency tests |
| rbac / audit | 4 | Hash chain, encryption, RBAC sweep |
| platform console | 4 | Orgs, licenses, impersonation |
| onboarding / licensing | 4 | Module gate, bundle editor |

---

## Functional (Tier 3)

| Module | Tier | Notes |
|--------|------|-------|
| crm | 3 | Pipeline OK; activities CRM-only |
| hr | 3 | Employees, attendance, leave |
| payroll | 3 | Iraq auto-compute |
| banking | 3 | Reconciliation, import |
| taxes | 3 | Returns, settings |
| manufacturing | 3 | BOM/MO pages; MRP scheduler light |
| projects | 3 | Gantt; PSA depth limited |
| marketing | 3 | Campaigns basic |
| reports | 3 | Standard financial + embedded analytics v1 (`/reports/analytics`) |
| fixed_assets | 3 | Depreciation runs |
| subscriptions | 3 | Plans, MRR reports, dunning queue, pause/cancel lifecycle |
| restaurant (extended) | 3 | KDS, menu manager, table view (POS core remains production) |

---

## Preview (Tier 2)

| Module | Tier | Config needed |
|--------|------|---------------|
| einvoice | 2 | ITA portal, XSD, credentials |
| whatsapp | 2 | Meta Business API token |
| iraq_payments | 2 | FIB/Zain merchant keys |
| multi-entity | 2 | Consolidation pages live; TopBar entity switch partial |
| ai / ocr | 2 | External ML; preview data |
| automation-rules | 2 | UI only; no universal engine |

---

## Scaffold (Tier 1) — default hidden from new tenants

| Module | Tier | Notes |
|--------|------|-------|
| helpdesk | 1 | Tickets CRUD; no SLA production depth |
| field_service | 1 | Partial pages; ComingSoon tabs |
| documents / dms | 1 | Upload; signature ComingSoon |
| knowledge | 1 | Basic KB |
| quality / maintenance / plm | 1 | Wave A CRUD |
| livechat / social / elearning | 1 | Nav exists |
| healthcare / hospital / pharmacy | 1 | Vertical CRUD |
| hotel (extended) | 1 | Partial vs POS core |
| construction / real_estate / education | 1 | Vertical CRUD |
| logistics / agriculture / ngo / government | 1 | Vertical CRUD |
| iot / mobile ext | 1 | Scaffold |
| studio | 1 | Page; persistence limited |

---

## Default onboarding recommendation

**Enable for new Iraq SMB tenants:**
- accounting, sales, purchase, inventory, crm (optional), banking, taxes, hr (optional), pos (optional), l10n_iq

**Do NOT enable by default:**
- All tier-1 modules — require module request + vendor approval

---

## Promotion criteria (tier up)

To move **1 → 3**:
- [ ] ≥20 backend tests for module
- [ ] E2E scenario spec green
- [ ] No ComingSoon on primary user path
- [ ] RBAC permissions documented
- [ ] Help doc in `frontend/src/docs/`

To move **3 → 4** (production_core candidate):
- [ ] Listed in `LAUNCH_DECISION.md`
- [ ] Load test or integrity test
- [ ] Integration runbook if external deps
