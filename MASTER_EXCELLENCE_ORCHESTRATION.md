# 🎯 MASTER EXCELLENCE ORCHESTRATION — Zoho ERP (Apr–Jun 2026)

> **Mission:** Zoho ERP بگەیێنە ≥ 85% feature-parity لەگەڵ Odoo 19 + Zoho Books/Inventory/CRM/People/POS، بێ هیچ P0 gap.
> **Methodology:** Domain-by-domain audit (parallel) → consolidated sprint plan (sequential) → Karpathy-disciplined execution → verified gates.
> **Owner:** شادۆ پلانساز (this file) → dispatched by زۆهۆ مێشک.
> **Inputs:** `odoo-docs-19/_merged/odoo-19-MASTER.md`, `odoo-19-ACCOUNTING.md`, `odoo-19-ERP.md`, `MASTER_AUDIT_REPORTS/{buttons,dialogs,endpoints}.md`, `MASTER_PLAN_2026_EXCELLENCE.md`, `MASTER_PARITY_PLAN.md`.

---

## 📌 Snapshot — دۆخی ئێستا (Apr 24, 2026)

- Backend: 616 routes (Sprint 5 closed, 33 fixes shipped) — `backend/app/api/*.py` (49 modules)
- Frontend: React 19 + TS strict + AntD 6.3.5 RTL + Zustand 5
- Known parity gaps (from `MASTER_AUDIT_REPORTS/endpoints.md`): 18 missing endpoints, 2 method mismatches
- Modules complete: Books clone, POS (~110 ep), CRM, HR/Payroll, Inventory base, Iraq L10n, RBAC, 2FA, refresh tokens
- Modules partial: Manufacturing/MRP, Project, Marketing, E-commerce, Website, Subscriptions, Maintenance, Helpdesk, Documents, Sign, Studio-equivalent

---

## ١ — Audit Brief Template (یەکگرتوو بۆ هەموو ١٦ ئەیگێنت)

هەر ئەیگێنت ڕاپۆرتی خۆی بە **ئەم فۆرماتە تەنها** بنووسێت لە:
`MASTER_AUDIT_REPORTS/<agent-slug>-2026-q2.md`

```markdown
# <Module> Audit — 2026-Q2
Agent: <agent-name> | Date: YYYY-MM-DD | Session-time: <est. min>

## A. Coverage Snapshot
| Reference | Coverage % | Notes |
|-----------|-----------|-------|
| Odoo 19   | XX%       | <one line> |
| Zoho      | XX%       | <one line> |

## B. Top P0/P1 Gaps (max 10)
| ID | Severity | Title | File(s) | Odoo ref | Zoho ref | Effort |
|----|----------|-------|---------|----------|----------|--------|
| G-1| P0       | ...   | backend/app/api/x.py:L | applications/finance/.../foo.rst | Books > Bar | S/M/L |

## C. Quick Wins (< 1 session each)
- QW-1: <action> — file — outcome
- QW-2: ...

## D. Big Rocks (need full sprint)
- BR-1: <epic> — modules touched — est. sessions

## E. Odoo Features Missing
- `applications/finance/accounting/payments/follow_up.rst` — dunning automation
- `applications/inventory_and_mrp/inventory/warehouses_storage/replenishment/reordering_rules.rst`
- ... (cite exact section paths from `odoo-docs-19/_merged/odoo-19-MASTER.md` TOC)

## F. Zoho Features Missing
- Books > Recurring Expenses — not implemented
- ...

## G. Counts
P0: N | P1: N | P2: N | Quick wins: N | Big rocks: N

## H. Recommended Lead + Skills
Lead: <agent>, Support: <agent>, Skills: [skill-1, skill-2]
```

> **ڕێسا:** ڕاپۆرت ≤ 250 هێڵ بێت، concrete، file-referenced. هیچ prose-only، هیچ "TODO عام". هەر gap ـێک بێ Odoo/Zoho citation ڕەد دەکرێتەوە.

---

## ٢ — Parallel Audit Schedule (١٦ ئەیگێنت — Wave A & B)

**Wave A (هاوکات، ٨ ئەیگێنت — هیچ پەیوەندی نییە):**

| # | Agent | Scope (workspace paths) | Odoo refs (in `odoo-docs-19/_merged/`) | Output |
|---|-------|-------------------------|----------------------------------------|--------|
| 1 | **زۆهۆ ئەکاونتینگ** | `backend/app/api/{accounts,invoices,credit_notes,vendor_credits,banking,fiscal,reports,taxes,transaction_locking}.py`، `services/journal*`، `services/tax*` | `odoo-19-ACCOUNTING.md` (entire file) + `applications/finance/accounting/{bank,customer_invoices,vendor_bills,reporting,taxes,payments,get_started}.rst` | `zoho-accounting-2026-q2.md` |
| 2 | **ERP CRM** | `backend/app/api/crm.py`، `frontend/src/pages/CRM*`، `pages/Leads*`، `pages/Opportunities*` | `applications/sales/crm/**` (acquire_leads, optimize, performance, pipeline, track_leads) | `erp-crm-2026-q2.md` |
| 3 | **ERP Inventory + MRP** | `backend/app/api/{inventory,manufacturing,shipments,returns}.py`، `services/inventory*`، `frontend/src/pages/Inventory*`, `Manufacturing*`, `Warehouses*` | `applications/inventory_and_mrp/inventory/**` + `manufacturing/**` (BOM, work_orders, kits, MPS, quality) | `erp-inventory-mrp-2026-q2.md` |
| 4 | **ERP HR + Payroll** | `backend/app/api/{hr,payroll,expenses,expense_claims,mileage,attachments}.py` | `applications/hr/**` (employees, attendances, time_off, payroll, recruitment, appraisals) | `erp-hr-payroll-2026-q2.md` |
| 5 | **ERP POS** | `backend/app/api/pos.py`، `_pos_qa.py`، `frontend/src/pages/POS*`، `pages/Cashier*` | `applications/sales/point_of_sale/**` (configuration, payment_methods, restaurant, shop, employee_login, pricing) | `erp-pos-2026-q2.md` |
| 6 | **ERP Sales + Purchase** | `backend/app/api/{sales_orders,quotes,purchase_orders,recurring_bills,recurring_invoices,delivery_*}.py` | `applications/sales/sales/**` + `applications/inventory_and_mrp/purchase/**` | `erp-sales-purchase-2026-q2.md` |
| 7 | **ERP Localization Iraq** | `backend/app/api/{l10n_iq,einvoice,taxes}.py`، `services/l10n_iq*` | `applications/finance/fiscal_localizations.rst` + IQ-relevant tax/WHT/e-invoicing patterns | `erp-l10n-iraq-2026-q2.md` |
| 8 | **ERP Security + Audit** | `backend/app/api/{auth,rbac,audit,custom_fields}.py`، `middleware/*`، `services/auth*` | `applications/general/users/**` + Odoo access rights/record rules + 2FA/SSO | `erp-security-2026-q2.md` |

**Wave B (دوای Wave A — ٨ ئەیگێنت — هەندێک پەیوەندی هەیە):**

| # | Agent | Scope | Odoo refs | Output |
|---|-------|-------|-----------|--------|
| 9 | **ERP E-commerce + Website** | `frontend/src/pages/Portal*`، `backend/app/api/portals.py` | `applications/websites/{ecommerce,website}/**` | `erp-ecommerce-2026-q2.md` |
| 10| **ERP Marketing** | `backend/app/api/whatsapp.py`، `pages/Campaigns*` (if any) | `applications/marketing/{email_marketing,sms_marketing,marketing_automation,social_marketing,events,surveys}.rst` | `erp-marketing-2026-q2.md` |
| 11| **ERP Project + Timesheet** | `backend/app/api/projects.py`، `pages/Projects*`، `pages/Tasks*` | `applications/services/{project,timesheets,helpdesk,planning,field_service}.rst` | `erp-project-2026-q2.md` |
| 12| **ERP UX Designer** | `frontend/src/{layouts,components,design-system,global.css}`، AntD theme | Odoo "responsive web" + UX guidelines (general/web) | `erp-ux-2026-q2.md` |
| 13| **ERP Integration** | `backend/app/api/{ocr,whatsapp,einvoice,payment_links,einvoice}.py`، `services/integration*` | `applications/general/{integrations,iot,email_communication}.rst` + payment_acquirers | `erp-integration-2026-q2.md` |
| 14| **ERP Migration** | `backend/app/api/{imports,exports}.py`، `_sweep_report.json`، migration scripts | `applications/essentials/export_import_data.rst` + Odoo Studio data import | `erp-migration-2026-q2.md` |
| 15| **ERP DevOps** | `docker-compose*.yml`، `backend/Dockerfile`، `frontend/Dockerfile`، `start*.bat/.ps1`، `nginx.conf` | `administration/{on_premise,odoo_sh,upgrade}.rst` + monitoring/backup patterns | `erp-devops-2026-q2.md` |
| 16| **ERP Odoo Researcher** | Cross-cutting: top 30 Odoo apps not yet covered (Subscription, Sign, Documents, Maintenance, Studio, Discuss, Approvals deep, Knowledge) | `applications/{productivity,sales/subscriptions,services/helpdesk,inventory_and_mrp/maintenance}/**` | `erp-odoo-researcher-2026-q2.md` |

**Dispatch instructions to each agent (template):**
```
You are <agent>. Read MASTER_EXCELLENCE_ORCHESTRATION.md §1 (Audit Brief Template) و §2 row #N.
Audit ONLY your scope. Cite Odoo paths exactly from odoo-19-MASTER.md TOC.
Produce <output-file>. ≤ 250 lines. No code changes.
Report DONE with file path + 3-line summary. Stop.
```

---

## ٣ — Consolidation Step (پلانساز پاش هەردوو Wave)

پلانساز ئەم هەنگاوانە جێبەجێ دەکات:

1. **Read all 16 reports** → extract every gap into a single backlog table.
2. **Cross-cutting detection** — هەر gap کە لە ≥ 2 module دەردەکەوێت (نموونە: serial-number tracking لە POS+Inventory+Sales، یان dunning لە Accounting+CRM) → master fix.
3. **Priority Matrix:**
   ```
   Impact ↑    │ Quick Win (do first)  │ Big Rocks (sprint each)
              │  (low effort, high impact) │ (high effort, high impact)
   ───────────┼────────────────────────┼────────────────────────
   Impact ↓   │ Backlog (defer)        │ Avoid (high effort, low impact)
              └─ low effort ──────────── high effort →
   ```
4. **Sprint-by-sprint plan** — لە Sprint 6 ـەوە دەست پێ دەکات. هەر سپرینت پێویستە:
   - دیار: Lead agent، Support agents، Skills used
   - لیستی fix-IDs (FIX-36، FIX-37 ...)
   - Dependencies بۆ سپرینتی پێشوو
   - Verification gate (concrete commands)
   - Estimated sessions

### ٣.١ — Sprint Skeleton (پلانساز پاش audit ـەکان پڕی دەکاتەوە)

| Sprint | Theme | Lead | Fix-IDs | Skills | Dep | Verify | Sessions |
|--------|-------|------|---------|--------|-----|--------|----------|
| 6 | Endpoint gap closure (18 missing + 2 method) | زۆهۆ باکئێند | FIX-36 … FIX-55 | `python-patterns`, `firestore-patterns`, `api-design-fastapi` | — | endpoint-audit.mjs returns 0 missing | 2 |
| 7 | Accounting parity — dunning, follow-up, reconciliation rules | زۆهۆ ئەکاونتینگ | FIX-56 … FIX-7? | `python-patterns`, `verification-loop` | S6 | smoke + double-entry invariants | 3 |
| 8 | Inventory + MRP parity — putaway, reordering, work orders, MPS | ERP Inventory | FIX-?? … | `firestore-patterns` | S6 | inventory invariants script | 3 |
| 9 | CRM + Sales pipeline — automated actions, lost reasons, recurring | ERP CRM | FIX-?? … | `react19-patterns` | S6 | smoke | 2 |
| 10 | HR + Payroll — appraisals, time-off rules, IQ payroll | ERP HR | FIX-?? … | `python-patterns` | S6 | payslip golden test | 2 |
| 11 | POS — restaurant tables, loyalty, employee login completeness | ERP POS | FIX-?? … | `react19-patterns` | S6 | pos QA suite | 2 |
| 12 | Marketing + E-commerce — automation, online store flow | ERP Marketing + E-commerce | FIX-?? … | `antd-rtl-patterns` | S9 | e2e checkout | 3 |
| 13 | Project + Helpdesk + Subscription | ERP Project | FIX-?? … | `python-patterns` | S6 | smoke | 2 |
| 14 | Integration + Migration + L10n IQ deep | ERP Integration | FIX-?? … | `security-review-owasp` | — | webhook + import golden | 2 |
| 15 | UX, RTL polish, dashboards, dark mode, PWA | ERP UX + شادۆ دیزاینەر | FIX-?? … | `antd-rtl-patterns` | all | npm run build green | 2 |
| 16 | Security hardening + audit log completeness + 2FA SSO | ERP Security + شادۆ ئاژێنت‌شیلد | FIX-?? … | `agentshield-rules`, `security-review-owasp` | — | agentshield 0 high | 2 |
| 17 | DevOps — CI gate، backup، monitoring، Windows deploy script | ERP DevOps | FIX-?? … | `deployment-windows` | all | docker-compose up clean | 1 |
| 18 | Final integration + sign-off | شادۆ ئیڤاڵ | — | `verification-loop` | all | success criteria §5 | 1 |

> هەر "FIX-??" پاش consolidation بە ID ـی دیاری‌کراو پڕ دەکرێتەوە لە `/memories/session/parity-execution.md`.

---

## ٤ — Execution Discipline

### Karpathy 4 (always-on)
1. **Think** — پێش هەر sprint، lead agent ئەم چوار شتە بە چەند هێڵێک بنووسێت: Goal، Files، Risks، Verification.
2. **Simplicity** — هیچ abstraction نوێ بێ پێویستی direct.
3. **Surgical** — diff تەنها هێڵە پەیوەندیدارەکان. هیچ drive-by formatting/refactor.
4. **Goal-driven** — هەر fix-ID endpoint-ـی concrete verification ـی هەیە.

### Verification Gate (هەر fix پێش merge)
```powershell
# Backend
cd c:\Users\SAFA\zoho\backend
venv\Scripts\python.exe -c "from app.main import app; print(len(app.routes))"
venv\Scripts\python.exe test_all.py

# Frontend
cd c:\Users\SAFA\zoho\frontend
npm run build       # tsc -b + vite build — هەردووکی پێویستن
node scripts/endpoint-audit.mjs
```
هەر یەک شکست → fix ـەکە ڕەد دەکرێتەوە و دیسان دەنێردرێتەوە بۆ lead agent.

### NEVER (سەنگین)
- ❌ هیچ merge بێ verify
- ❌ هیچ `--no-verify` Git
- ❌ هیچ تەنها `tsc --noEmit` — full `npm run build` پێویستە
- ❌ هیچ Firestore composite index — Python-side filtering
- ❌ هیچ `&&` لە PowerShell — `;` بەکار بهێنە
- ❌ هیچ skip بۆ memory update

### Memory Updates (پاش هەر sprint)
Edit `/memories/session/parity-execution.md` بە:
- Sprint #، تاریخ، fix-IDs ـی شیپ‌کراو
- Verification result (✅/❌)
- Lessons learned (1-3 bullets) → هەر لێرەی repeat → بنێرە بۆ `/memories/instincts/`

### "بەردەوام بە" Mandate
ئۆرکێسترەیتەر (شادۆ ئۆرکێسترەیتەر) ناوەستێت تا Sprint 18 verify دەکرێت ئەگەر:
- پێکهاتەی autonomous loop چالاک بێت، **و**
- هیچ P0 blocker پێشنەکەوێت (security vuln، data corruption، auth break)
بۆ blocker → halt + escalate بۆ بەکارهێنەر، نا silent skip.

---

## ٥ — Success Criteria (تەواو بوون)

سیستەمەکە کاتێک "Excellence" پێی دەوترێت کە **هەموو** ئەمانە ✅ بن:

| # | Criterion | Measurement |
|---|-----------|-------------|
| 1 | هیچ P0 gap بەجێ نەماوە | Backlog table: P0 count = 0 |
| 2 | هەر module ≥ 85% Odoo parity | هەر `<agent>-2026-q2.md` re-run، coverage column ≥ 85% |
| 3 | Endpoint audit clean | `node frontend/scripts/endpoint-audit.mjs` → 0 missing، 0 method-mismatch |
| 4 | Backend healthy | `python test_all.py` → 100% pass، `len(app.routes) ≥ 616` |
| 5 | Frontend build green | `npm run build` → 0 errors، 0 TS errors |
| 6 | Security clean | شادۆ ئاژێنت‌شیلد → 0 High، ≤ 5 Medium |
| 7 | Test coverage threshold | backend ≥ 70% lines on services/، frontend smoke pages all 200 |
| 8 | Documentation up-to-date | `MASTER_AUDIT_REPORTS/*-2026-q2.md` re-generated، `MASTER_PARITY_PLAN.md` synced |
| 9 | i18n complete | هەر key لە `en.json` لە `ku.json` ـیش هەیە (audit script) |
| 10| Karpathy adherence | Spot-check 5 random merged sprints — diff scope-bound، no drive-by |

### Final Sign-off (Sprint 18 — شادۆ ئیڤاڵ)
ڕاپۆرتی نهایی لە `MASTER_AUDIT_REPORTS/_FINAL_SIGNOFF_2026Q2.md` تۆمار دەکرێت بە:
- 10/10 criteria ✅
- لیستی هەموو fix-IDs (FIX-36 … FIX-N)
- Before/after parity table بۆ ١٦ module
- Open P2/P3 backlog (carried to Q3)

---

## 📎 Appendices

### A. Fix-ID Registry (پلانساز پاش audit پڕی دەکاتەوە)
```
FIX-36  Sprint 6  Backend  POST /api/credit-notes/{id}/apply (was {x}/{x})
FIX-37  Sprint 6  Backend  GET /api/credit-notes/{id}/applications
FIX-38  Sprint 6  Backend  DELETE /api/credit-notes/{id}/applications/{appId}
FIX-39  Sprint 6  Backend  CRUD /api/delivery-challans (4 routes)
FIX-43  Sprint 6  Backend  Fiscal budgets endpoints (3)
FIX-46  Sprint 6  Backend  POST /api/fiscal/years/{id}/close
FIX-47  Sprint 6  Backend  POST /api/invoices/{id}/apply-retainer
FIX-48  Sprint 6  Backend  Action endpoints for PO/SO/Quote/RecInv/VendorCredit (5)
FIX-53  Sprint 6  Backend  GET /api/reports/{key}/{format} export
FIX-54  Sprint 6  Backend  Method fix POST/GET /api/fiscal/years
FIX-55  Sprint 6  Backend  Method fix DELETE /api/recurring-invoices/{id}
FIX-56+ Sprint 7+ ... (filled by پلانساز after consolidation)
```

### B. Odoo TOC Quick Refs (لە `odoo-docs-19/_merged/odoo-19-MASTER.md`)
- Finance → `applications/finance/accounting/**` (~600 sections)
- Inventory/MRP → `applications/inventory_and_mrp/**`
- Sales/CRM → `applications/sales/**`
- HR → `applications/hr/**`
- Marketing → `applications/marketing/**`
- Services (Project/Helpdesk) → `applications/services/**`
- Websites/E-commerce → `applications/websites/**`
- Productivity (Sign/Documents/Discuss/Knowledge) → `applications/productivity/**`
- Essentials (Import/Activities/Stages) → `applications/essentials/**`
- General (Users/IoT/Integrations) → `applications/general/**`
- Administration → `administration/**`

### C. Wave dispatch one-liners (بۆ زۆهۆ مێشک)
```
Wave A: dispatch agents 1..8 in parallel with row-N brief from §2. ETA: 1 day.
Gate A: 8 reports landed in MASTER_AUDIT_REPORTS/.
Wave B: dispatch agents 9..16 in parallel. ETA: 1 day.
Gate B: 16 reports total. → Trigger پلانساز consolidation (§3).
```

---

**Document version:** 1.0 | **Date:** 2026-04-24 | **Author:** شادۆ پلانساز
**Next action (when audits land):** پلانساز fills Fix-ID Registry §A و sprint table §3.1، then dispatches to شادۆ ئۆرکێسترەیتەر.
