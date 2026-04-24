تێبینی: لە مۆدی **شادۆ پلانساز** هیچ tool ـی نووسینی فایلم نییە (و رولەکانیشم دەڵێن "فایل مەنووسە"). پلانە تەواوەکە لە خوارەوە دادەنێم — تۆ دەتوانیت ڕاستەوخۆ کۆپی بکەیت بۆ `MASTER_PARITY_PLAN.md`، یان ئامادەم بڵێم بە **شادۆ دەڤەلۆپەر** فایلەکە دروست بکات.

---

# 🏛️ MASTER PARITY PLAN — Zoho/Odoo Clone Completion

> **ئامانج:** پرۆژەی Zoho ERP بگەینە parity ـی تەواو لەگەڵ Odoo 19 + Zoho Books بە بەرزترین کوالێتی  
> **سەرچاوە:** `odoo-docs-19/_merged/odoo-19-MASTER.md` + `zoho.com/books`  
> **ئامراز:** ٣٢ ئەیگێنتی بەردەست + ٤ بنەمای Karpathy  
> **بەروار:** Apr 2026 — ECC v1.1 baseline

---

## 📋 0. Executive Summary

پرۆژە لە ئێستادا ٥٧ endpoint group + ٧٠+ لاپەڕەی هەیە (Zoho Books تەواو + POS + ابتدایی Odoo modules). بۆ گەیشتن بە Odoo parity پێویستە **CRM، MRP، HR/Payroll، E-commerce، Marketing، Website CMS، Fleet، Helpdesk، Subscription، Field Service، Documents، Sign، Knowledge** کامڵ بکرێن، لەگەڵ deepening ـی modulesی هەنووکە.

پلانەکە چوار قۆناغی هەیە:
1. **Audit (Parallel)** — ١٤ ئەیگێنتی domain هاوکات gap analysis دەکەن  
2. **Consolidation** — پلانساز ڕاپۆرتەکان دەخاتە یەک master backlog  
3. **Execution Loop** — ١٠ sprint بە dependency گرافی ڕوون  
4. **Quality Gates** — ئاژێنت‌شیلد + تێستەر + ئیڤاڵ + ئۆتۆماسیۆن

**No-Stop Rule:** هیچ sprint نەهێڵدرێت تا گرین بێت لە هەموو quality gate ـەکان.

---

## 🔍 PHASE 1 — Audit Phase (Parallel Execution)

### 1.1 ئامانج
هەر ئەیگێنتی domain لە بواری خۆیدا codebase ـی ئێستا چێک دەکات، بە Odoo 19 + Zoho بەراورد دەکات، gap report دەنووسێت.

### 1.2 Audit Output Template (پێویستە هەموو ئەیگێنت بەکاری بهێنن)

ڕاپۆرت دەنووسرێت لە: `/memories/repo/audit/<agent-slug>.md`

```markdown
# Audit Report — <Domain Name>
**ئەیگێنت:** <agent>
**بەروار:** YYYY-MM-DD
**Baseline:** Odoo 19 + Zoho Books (<URL/section>)

## 1. کۆتا بڕیار (TL;DR)
<٣ ڕستە: ئاستی parity چەندە؟ گرنگترین gap چییە؟>

## 2. Coverage Matrix
| Feature (Odoo/Zoho) | پرۆژەی ئێستا | ستاتەس | Priority |
|---------------------|---------------|--------|----------|
| Lead scoring        | ✅ تەواو      | OK     | —        |
| Lead enrichment     | ⚠️ کەم        | PARTIAL| P1       |
| ...                 | ❌ نییە       | MISSING| P0       |

## 3. Files Inspected
- backend/app/api/<x>.py
- backend/app/services/<x>.py
- frontend/src/pages/<X>.tsx
- ...

## 4. Gap Details (per missing feature)
### G-01: <Feature name>
- **Source:** Odoo doc path / Zoho URL
- **Why needed:** <١-٢ ڕستە>
- **Estimated effort:** S/M/L/XL
- **Dependencies:** <لیستی gap-id>
- **Acceptance:** <bullet test cases>

## 5. Quality Issues (لەگەڵ شتە هەنووکەییەکان)
- N+1 query لە ...
- i18n key نەشێرکراو لە ...
- RBAC check نییە لە ...

## 6. Suggested Sprint Slot
Sprint X (هۆکار: dependency لەسەر Y)
```

### 1.3 Audit Assignments Table

| # | ئەیگێنت | Domain | فایلە سەرەکیەکان بۆ چێک | بەرامبەر | ڕاپۆرت |
|---|---------|--------|------------------------|----------|--------|
| A1 | `ERP CRM` | CRM, Pipeline, Activities | `api/crm.py`, `pages/CRM*.tsx` | Odoo `applications/sales/crm` + Zoho CRM | `/memories/repo/audit/crm.md` |
| A2 | `ERP Sales + Purchase` | SO, PO, RFQ, Delivery | `api/sales_orders.py`, `purchase_orders.py`, `quotes.py`, `shipments.py`, `returns.py` | Odoo `sales/sales` + `purchase` | `/memories/repo/audit/sales-purchase.md` |
| A3 | `ERP Inventory + MRP` | Stock, BOM, WO, Lots | `api/inventory.py`, `manufacturing.py`, `pages/Mfg*.tsx`, `Inventory.tsx`, `Warehouses.tsx`, `SerialNumbers.tsx` | Odoo `inventory_and_mrp/*` | `/memories/repo/audit/inventory-mrp.md` |
| A4 | `ERP HR + Payroll` | Employees, Attendance, Time-off, Payroll | `api/hr.py`, `payroll.py`, `pages/HR*.tsx`, `Payroll*.tsx` | Odoo `applications/hr/*` | `/memories/repo/audit/hr-payroll.md` |
| A5 | `ERP Project + Timesheet` | Tasks, Gantt, Profitability | `api/projects.py`, `pages/Projects.tsx` | Odoo `services/project` + `timesheets` | `/memories/repo/audit/project.md` |
| A6 | `ERP POS` | Sessions, Cash, Restaurant | `api/pos.py`, `pages/pos/**` | Odoo `sales/point_of_sale` + Zoho Inventory POS | `/memories/repo/audit/pos.md` |
| A7 | `ERP E-commerce` | Catalog, Cart, Checkout, CMS | (ئێستا نییە) | Odoo `websites/*` | `/memories/repo/audit/ecommerce.md` |
| A8 | `ERP Marketing` | Email, SMS, Automation | `api/whatsapp.py` تەنها | Odoo `marketing/*` | `/memories/repo/audit/marketing.md` |
| A9 | `ERP Localization Iraq` | VAT, Withholding, IQD, e-invoice | `api/l10n_iq.py`, `einvoice.py`, `taxes.py`, `services/pdf_generator.py` | Iraq tax law + Odoo `fiscal_localizations` | `/memories/repo/audit/iraq.md` |
| A10 | `ERP Security + Audit` (= `ERP Security`) | RBAC, Audit, 2FA, Roles | `api/rbac.py`, `audit.py`, `middleware/*`, `pages/RbacRoles.tsx`, `UserRoles.tsx`, `AuditLog.tsx` | Odoo `general/users` + OWASP | `/memories/repo/audit/security.md` |
| A11 | `ERP Integration` | Webhooks, OCR, WhatsApp, External API | `api/ocr.py`, `whatsapp.py`, `payment_links.py`, `einvoice.py` | Odoo `external_api` + Zoho APIs | `/memories/repo/audit/integration.md` |
| A12 | `ERP Migration` | Imports, Excel/CSV | `api/imports.py`, `exports.py` | Odoo import wizard + Zoho migration | `/memories/repo/audit/migration.md` |
| A13 | `زۆهۆ ئەکاونتینگ` | Journals, COA, Tax, Banking, Reports | `api/accounts.py`, `banking.py`, `fiscal.py`, `taxes.py`, `reports.py`, `transaction_locking.py`, `assets.py`, `expenses.py`, `expense_claims.py`, `mileage.py`, `recurring_*` | Zoho Books + Odoo `accounting` | `/memories/repo/audit/accounting.md` |
| A14 | `ERP UX Designer` + `زۆهۆ فرۆنتئێند` | UX, RTL, AntD, i18n, Performance | `frontend/src/pages/**`, `components/**`, `layouts/**`, `locales/*.json`, `App.tsx`, `i18n.ts` | AntD 6.3 best practices + Zoho UX | `/memories/repo/audit/ux-frontend.md` |
| A15 | `زۆهۆ داتابەیس` | Firestore schema, repos, indexes | `app/firestore/**`, `schemas/**` | Zoho Books data model + Odoo ORM | `/memories/repo/audit/database.md` |
| A16 | `ERP DevOps` + `زۆهۆ تێستەر` | CI/CD, tests, monitoring, build | `Dockerfile*`, `test_*.py`, `nginx.conf`, `start-*.ps1`, `vite.config.ts` | Industry standard | `/memories/repo/audit/devops-qa.md` |

> **ئێگزترا:** ئەیگێنتی `ERP Odoo Researcher` پشتگیری هەموو Audit دەکات بە تامینکردنی Odoo doc snippet ـەکان لە `odoo-19-MASTER.md`.

### 1.4 Audit Execution Rules

1. **Parallel:** هەموو ١٦ ئەیگێنت هاوکات کاردەکەن — هیچ dependency نییە لە نێوانیان.
2. **Read-only:** هیچ ئەیگێنتێک کۆد ناگۆڕێت لەم قۆناغەدا.
3. **Time-box:** هەر audit ≤ ٢ session (token-budget لە `harness-optimizer`).
4. **Skill stack:** هەر ئەیگێنت دەبێت ئەم سکیڵانە چالاک بکات: `meta/karpathy-guidelines`, `meta/search-first`, `docs/documentation-lookup`, `meta/verification-loop`.
5. **Output:** Markdown کوردی + جەدوەلی `Coverage Matrix` پێویستە.

### 1.5 Audit Acceptance Criteria
- ✅ هەموو ١٦ ڕاپۆرت لە `/memories/repo/audit/` بوونی هەیە
- ✅ هەر ڕاپۆرت Coverage Matrix + Gap Details + Suggested Sprint Slot ـی هەیە
- ✅ هیچ gap بێ Priority (P0/P1/P2) و بێ Acceptance criteria نییە
- ✅ شادۆ ئاژێنت‌شیلد ڕاپۆرتە سەرەکیەکانی security flag کردووە (P0 ـن خۆکار)

---

## 🧮 PHASE 2 — Consolidation

### 2.1 بەرپرس
**شادۆ پلانساز** + پشتگیری `ERP Brain`.

### 2.2 پرۆسە (Step-by-step)

1. **Ingestion:** پلانساز هەموو ١٦ ڕاپۆرتی audit دەخوێنێتەوە.
2. **Normalization:** هەر gap وەردەگیرێت بۆ unified row:
   ```
   ID | Domain | Title | Source | Effort | Priority | Dependencies | Acceptance | Owner-Agent
   ```
3. **Deduplication:** gap ـە دووبارەکان (مثال: i18n missing لە چەند ڕاپۆرت) دەکرێن یەک parent + sub-tasks.
4. **Priority Re-rank:** بە formula:
   - P0 = (security | data-loss | regulatory | blocker بۆ دیکە)
   - P1 = (Odoo-parity core | کاریگەری بەکارهێنەری ڕۆژانە)
   - P2 = (nice-to-have | performance polish)
5. **Dependency Graph:** پلانساز DAG ـی gap → gap دادەنێت (text adjacency list لە backlog ـدا).
6. **Sprint Allocation:** هەر sprint ≤ ٢٠٠ effort-point، dependency-respecting topological order.
7. **Master Backlog Output:** `/memories/repo/audit/_MASTER_BACKLOG.md` (single source of truth).

### 2.3 Consolidation Acceptance
- ✅ هیچ gap لە backlog ون نییە
- ✅ هیچ cycle لە dependency graph نییە
- ✅ هەموو P0 لە Sprint 1–3
- ✅ ERP Brain sign-off کردووە

---

## 🚀 PHASE 3 — Execution Loop (١٠ Sprints)

### 3.1 Sprint Cadence
- **مودەی sprint:** کاتی ڕاستی (نا-تخمینی) — تا quality gate گرین نەبێت، sprint کۆتایی ناهێنرێت.
- **Daily flow:** Implement → Self-test → ئاژێنت‌شیلد → تێستەر → ئیڤاڵ → کۆچ.

### 3.2 Sprint Structure (پێشنیازی، دوای backlog finalization adjust دەکرێت)

| Sprint | تایتل | ئەیگێنتە سەرەکیەکان | Dependency |
|--------|-------|---------------------|-----------|
| **S1** | **Foundation Hardening** — Security gaps (P0)، RBAC deepening، 2FA، Audit log full coverage، secret rotation | `ERP Security`, `شادۆ ئاژێنت‌شیلد`, `زۆهۆ باکئێند` | — |
| **S2** | **Accounting Parity P0** — Bank reconciliation UI، Bank rules، CSV import، Asset depreciation finalization، Transaction locking edge cases، Multi-currency revaluation | `زۆهۆ ئەکاونتینگ`, `زۆهۆ باکئێند`, `زۆهۆ فرۆنتئێند`, `زۆهۆ داتابەیس` | S1 |
| **S3** | **Inventory + MRP Deepening** — Lots/Serials full UI، Putaway rules، Reordering rules، Landed costs، BOM nested، Work Order Kanban، Barcode mobile flow | `ERP Inventory + MRP`, `زۆهۆ داتابەیس`, `زۆهۆ فرۆنتئێند` | S2 (cost accounting) |
| **S4** | **CRM Parity** — Lead scoring + enrichment، Activity types، Pipeline forecasting، Email integration، Reports + dashboards | `ERP CRM`, `زۆهۆ فرۆنتئێند` | S1 |
| **S5** | **Sales + Purchase Lifecycle Closure** — Quote→SO→Delivery→Invoice→Payment، RFQ vendors compare، Drop-shipping، Backorders، Subscription orders | `ERP Sales + Purchase`, `ERP Inventory + MRP` | S3 |
| **S6** | **HR + Payroll Iraq** — Contracts، Attendance (Face/PIN/Manual)، Time-off approval، Salary rules بۆ عێراق، Payslip PDF RTL، Year-end | `ERP HR + Payroll`, `ERP Localization Iraq`, `زۆهۆ ئەکاونتینگ` | S2 (journal posting) |
| **S7** | **POS Excellence** — Restaurant tables، Kitchen display، Loyalty، Offline IndexedDB sync، Multi-cashier session reconciliation | `ERP POS`, `زۆهۆ فرۆنتئێند` | S3 (stock moves) |
| **S8** | **E-commerce + Website CMS** — Catalog، Cart، Guest checkout، Stripe/local gateway، Page builder lite، Blog، SEO | `ERP E-commerce`, `زۆهۆ فرۆنتئێند`, `ERP Integration` | S5 |
| **S9** | **Marketing + Communications** — Email campaigns + templates، SMS bulk، WhatsApp templates، Marketing automation، Surveys، Events | `ERP Marketing`, `ERP Integration` | S4 (CRM segments) |
| **S10** | **Polish + Migration + DevOps** — Excel/CSV bulk import wizard، QuickBooks/Zoho importer، PWA + dark mode complete، Production deploy، Monitoring، Backup automation، Performance pass | `ERP Migration`, `ERP UX Designer`, `ERP DevOps`, `شادۆ ئەدا`, `شادۆ هارنیس` | All |

> **Future (post-parity):** Helpdesk، Field Service، Subscription، Documents/Sign، Knowledge، Fleet — sprint S11+ بەپێی پێویست.

### 3.3 Sprint Internal Workflow (هەر sprint)

```
0. Kickoff
   → ERP Brain sprint-plan دادەنێت لە /memories/session/sprint-<n>.md
   → ئەرکەکان دابەش دەکرێن بۆ ئەیگێنتەکان

1. Implement
   → دەڤەلۆپەرە دۆمەینەکان gap-by-gap کۆد دەنووسن
   → Surgical changes فقط (Karpathy rule #3)
   → هەر gap commit ـی جیای خۆی هەیە

2. Self-test
   → Backend: venv\Scripts\python.exe test_all.py
   → Frontend: npm run build (نا تەنها tsc --noEmit)

3. Security Gate
   → شادۆ ئاژێنت‌شیلد (102 rules) دەکات scan
   → هەموو P0/P1 پێویستە fix بکرێت پێش بەردەوامبوون

4. Test Gate
   → شادۆ تێستەر new endpoint smoke + regression
   → e2e Playwright بۆ critical flows (لە Sprint 7+)

5. Eval Gate
   → شادۆ ئیڤاڵ score ≥ 0.85 لەسەر:
       - Coverage (gap closure %)
       - Code quality (lint + complexity)
       - i18n completeness (ku + en parity)
       - RTL visual sanity

6. Continuous Learning
   → شادۆ کۆچ instinct extract → /memories/instincts/
   → شادۆ سکیڵ‌میکەر ئەگەر pattern نوێ هەبێت → سکیڵ نوێ

7. Documentation
   → شادۆ دۆکیومێنتەر README + API docs update

8. Close
   → ERP Brain sprint sign-off
   → backlog ـی نوێ adjust دەکرێت
```

### 3.4 Daily Quality Heartbeat (لە هەر sprint)
- ⏱ هەر کاتژمێر `npm run build` + `test_all.py`
- 🛡 هەر commit AgentShield pre-commit
- 📊 هەر ڕۆژ ئیڤاڵ scoreboard لە `/memories/session/sprint-<n>-score.md`

---

## 🛡 PHASE 4 — Quality Gates + Acceptance Criteria

### 4.1 Per-Gap Acceptance (DoD)
هەر gap "Done" نییە تا:
- ✅ Code merged + passes `npm run build`
- ✅ Backend `test_all.py` پاس
- ✅ Endpoint smoke test (تێستەر)
- ✅ i18n کلیلە نوێ هەردووکیان (`ku.json` + `en.json`) ـدا هەن
- ✅ AntD RTL visual پاس (دیزاینەر sign-off)
- ✅ AgentShield clean (هیچ P0/P1 نییە)
- ✅ Audit log entry دروست دەنووسرێت بۆ هەر mutation
- ✅ Documentation update (دۆکیومێنتەر)

### 4.2 Per-Sprint Acceptance
- ✅ ≥ 95% gap closure ـی sprint
- ✅ هیچ regression لە test_all.py
- ✅ Eval score ≥ 0.85
- ✅ کۆچ instinct extract کرد
- ✅ ERP Brain sign-off

### 4.3 Per-Module Acceptance (Parity definition)
مۆدول "Parity" کاتێک:
- ✅ ≥ 90% Odoo core feature coverage (audit matrix)
- ✅ هەموو Zoho equivalent ـەکان هەن
- ✅ Iraq localization اعمال (VAT/IQD/Kurdish)
- ✅ End-to-end Playwright flow پاس
- ✅ Performance: page load ≤ 2s, API p95 ≤ 300ms

### 4.4 Project-level Acceptance
- ✅ ١٢ مۆدولی Odoo parity statusیان "Parity"
- ✅ Total endpoint count ≥ 500
- ✅ Page count ≥ 120
- ✅ i18n key count ≥ 1500 لە هەر زمان
- ✅ Lighthouse ≥ 90 (Performance, Accessibility, Best Practices, SEO)
- ✅ AgentShield clean run
- ✅ هیچ P0/P1 backlog item نەماوە

---

## ⚠ Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|----|------|------------|--------|------------|-------|
| R1 | Firestore composite-index limits | High | Med | هەموو filter لە Python (rule موجود)، NoIndex test لە تێستەر | داتابەیس |
| R2 | Token budget exhaustion لە Audit phase | Med | High | هارنیس compaction + شادۆ مێمۆری chunking | هارنیس |
| R3 | i18n drift (ku vs en) | High | Med | CI script: `i18n-audit.py` چێک دەکات parity | ناوەڕۆک |
| R4 | RTL visual regression لە AntD upgrade | Med | High | Playwright visual snapshots لە هەر sprint | تێستەر |
| R5 | Iraq tax law updates لە میانەی پلان | Low | High | localization agent monthly check | Localization Iraq |
| R6 | Scope creep (نوێ feature لە میانەی sprint) | High | Med | Brain backlog freeze؛ نوێ → sprint داهاتوو | ERP Brain |
| R7 | E-commerce + Marketing بێ baseline UI کۆد | Med | High | Sprint 8/9 پێش implementation `ERP UX` wireframes دادەنێت | UX |
| R8 | Migration data corruption | Low | Critical | Dry-run + idempotent imports + backup pre-import | Migration + DevOps |
| R9 | Security regression (RBAC bypass) | Med | Critical | AgentShield pre-commit + integration tests بۆ هەر role | Security |
| R10 | Performance degradation لەگەڵ زیادبوونی data | High | Med | شادۆ ئەدا بە Lighthouse + k6 لە sprint 10 | ئەدا |

---

## 📈 Success Metrics (چۆن دەزانین تەواو بووە؟)

### Quantitative
| Metric | Baseline | Target |
|--------|----------|--------|
| Backend endpoints | ~280 | ≥ 500 |
| Frontend pages | 70 | ≥ 120 |
| i18n keys (ku.json) | ~700 | ≥ 1500 |
| Test coverage (smoke pass) | ~60% | ≥ 95% |
| AgentShield P0/P1 | unknown | 0 |
| Lighthouse score | unknown | ≥ 90 (all 4) |
| Modules at "Parity" | 4 (Books/POS/Iraq/Project) | 12 |

### Qualitative
- ✅ بەکارهێنەرێکی Odoo دەتوانێت بەبێ ڕاهێنانی نوێ پرۆژەکە بەکار بهێنێت لە domain ـی خۆیدا
- ✅ هیچ "TODO" یان "FIXME" گرنگ نەماوە لە کۆد
- ✅ هەموو mutation ـەک audit log دەنووسێت
- ✅ هەموو page ـەک skeleton + empty state + error state ـی هەیە
- ✅ کۆڵەکتیڤی ئەیگێنتەکان دەتوانن بەبێ مرۆڤ sprint ـێک تەواو بکەن (hands-off run)

---

## 🧭 ڕێبەری بەرپرسایەتی (RACI Snapshot)

| Activity | R (Responsible) | A (Accountable) | C (Consulted) | I (Informed) |
|----------|-----------------|-----------------|---------------|--------------|
| Audit phase | ١٦ domain agents | شادۆ پلانساز | ERP Odoo Researcher | شادۆ مێشک |
| Backlog consolidation | شادۆ پلانساز | ERP Brain | شادۆ مێمۆری | All agents |
| Sprint kickoff | ERP Brain | شادۆ مێشک | شادۆ پلانساز | All |
| Implementation | Domain agents | ERP Brain | UX, Security | تێستەر |
| Quality gates | تێستەر + ئاژێنت‌شیلد + ئیڤاڵ | شادۆ مێشک | All domain | بەکارهێنەر |
| Continuous learning | شادۆ کۆچ | شادۆ مێمۆری | شادۆ سکیڵ‌میکەر | All |
| Documentation | شادۆ دۆکیومێنتەر | ERP Brain | All | بەکارهێنەر |

---

## 🔁 Loop Termination Condition (No-Stop Rule)

ئۆرکێسترەیتکردنەکە **ناوەستێت** تا:
1. هەموو ١٢ مۆدول status = "Parity"
2. هەموو P0/P1 ـی backlog closed
3. Project-level acceptance criteria گرین
4. ERP Brain + شادۆ مێشک + بەکارهێنەر هەر سێکیان sign-off

ئەگەر blocker ڕاستەقینە دروست بوو (مثال API external ناتوانرێت دەستی پێبکات)، ئەیگێنت **کلێر بکات** پێش گەشتن، نا silent skip.

---

## 📝 پاشکۆ — فایلە دروستکراوەکان لە میانەی پلان

| فایل | بەرپرس | کاتی دروستکردن |
|------|--------|---------------|
| `MASTER_PARITY_PLAN.md` (ئەم فایلە) | شادۆ پلانساز | T0 |
| `/memories/repo/audit/<agent>.md` × 16 | Domain agents | T0 + Phase 1 |
| `/memories/repo/audit/_MASTER_BACKLOG.md` | شادۆ پلانساز | T0 + Phase 2 |
| `/memories/session/sprint-<n>.md` × 10 | ERP Brain | sprint kickoff |
| `/memories/session/sprint-<n>-score.md` × 10 | شادۆ ئیڤاڵ | sprint daily |
| `/memories/instincts/*.md` | شادۆ کۆچ | post-sprint |

---

## ✅ Definition of "Done" بۆ کۆتای پلان

> پرۆژەی Zoho ERP کاتێک "Done" دەبێت کە:
> - بازرگانێکی کوردستانی بتوانێت بە تەواوی Zoho Books یان Odoo Online ـی جێگیر بکات بە پرۆژەی ئێمە، بەبێ feature regression، بە RTL کوردی، IQD، و Iraq tax compliance.
> - هەموو ١٢ مۆدول، هەموو quality gate، هەموو success metric ـ گرین.
> - شادۆ مێشک ڕاپۆرتی کۆتایی parity دەرکات + sign-off لە بەکارهێنەر.

---

# 🎯 Executive Summary (کوردی، < ٢٠٠ وشە)

پلانەکە چوار قۆناغی هەیە. **یەکەم**، ١٦ ئەیگێنتی domain هاوکات (parallel) audit دەکەن — هەرکام لە بواری خۆیدا codebase ـی ئێستای پرۆژە بە Odoo 19 و Zoho Books بەراورد دەکات و gap report ـی بە template ـی ستاندارد دەنووسێت لە `/memories/repo/audit/<agent>.md`. ئەم قۆناغە read-only یە — هیچ کۆد ناگۆڕێت. **دووەم**، شادۆ پلانساز هەموو ١٦ ڕاپۆرت دەخوێنێتەوە، dedup دەکات، priority (P0/P1/P2) دادەنێت، dependency DAG دادەنێت، و master backlog ـێکی یەکگرتوو دادەنێت لە `_MASTER_BACKLOG.md`. **سێیەم**، ١٠ sprint بە ترتیبی dependency: Foundation Hardening → Accounting Parity → Inventory/MRP → CRM → Sales/Purchase → HR/Payroll → POS → E-commerce → Marketing → Polish/DevOps. هەر sprint بە لووپێکی شەش-هەنگاوی (Implement → Test → AgentShield → تێستەر → ئیڤاڵ → کۆچ) جێبەجێ دەبێت. **چوارەم**، quality gate ـە سەختەکان: per-gap DoD، per-sprint eval ≥ 0.85، per-module Odoo coverage ≥ 90%، Lighthouse ≥ 90، AgentShield zero P0/P1. **No-Stop Rule:** تا هەموو ١٢ مۆدول گرین نەبێت، loop ناوەستێت. بنەماکانی Karpathy (think → simplicity → surgical → goal-driven) لە هەر هەنگاوێک پابەستن.

---

دەتەوێت ئێستا بە **شادۆ دەڤەلۆپەر** بڵێم ئەم پلانە لە `MASTER_PARITY_PLAN.md` بنووسێت، یان دەستپێکی Phase 1 audit ـەکان بدەم بە **ERP Brain** ؟