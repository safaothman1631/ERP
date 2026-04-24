# MASTER AUDIT & GROW PLAN — Zoho ERP → World-Class

> **نووسەر:** شادۆ پلانساز
> **بەروار:** April 22, 2026
> **وەشان:** 1.0
> **زمان:** کوردی سۆرانی + تێرمە تەکنیکی ئینگلیزی
> **چوارچێوە:** Karpathy overlay (think → simplify → surgical → goal-driven)

---

## Executive Summary

پرۆژەی Zoho ERP لە ئاستێکی پێشکەوتوو دایە (Zoho Books clone تەواوە، POS بە ١١٠ endpoint، Iraq localization، ECC integration foundation). بەڵام بۆ گەیشتن بە ئاستی **Odoo 19 + Zoho One** پێویست بە ٢ شت هەیە: (١) **Audit ـی قووڵ لە core ـی accounting integrity** (double-entry، period closing، multi-currency، tax engine) چونکە لێرە "هەڵە = خەسارەی پارە"، (٢) **گەشەی ٧ مۆدوولی نەماو** (Manufacturing/MRP، HR/Payroll، CRM، Marketing، Project advanced، E-commerce، Subscriptions). پلانەکە لە **١٤ قۆناغ** ڕێکخراوە، ٤ قۆناغی یەکەم تەواو لە **accounting correctness**، ١٠ قۆناغی پاشان بۆ **module expansion + UX/perf/security**. هەر قۆناغ owner agent، verification، test، و rollback ـی هەیە. پێشنیار: دەستپێبکە لە **قۆناغ ٠ (Accounting Audit)** پێش هیچ feature ـی نوێ.

**KPI ـە سەرەکیەکان:** 0 unbalanced journal، VAT return reconciliation = 100%، test coverage backend ≥ 70%، AgentShield 0 critical، p95 API latency < 300ms.

---

## 🧠 Assumptions (Karpathy: Think Before Coding)

پێش دەستپێکردن، ئەم گریمانانە ڕاشکاوانە دادەنێم — ئەگەر یەکێکیان هەڵەیە، پێم بڵێ پێش جێبەجێکردن:

1. **A1 — Single tenant per Firestore project:** هەموو queries بە `org_id` فلتەر دەکرێن لە Python (نا composite indexes).
2. **A2 — Currency:** IQD primary، USD secondary، Multi-currency لە model ـدا هەیە بەڵام revaluation تەواو نەکراوە.
3. **A3 — Accounting basis:** Accrual (نا cash). Period closing بە دەست (manual) ئەنجام دەدرێت ئێستا.
4. **A4 — User base:** ١-٢٠ بەکارهێنەری هاوکات لە هەر org. Performance budget: API p95 < 500ms.
5. **A5 — Deployment:** Windows dev، production لە Firebase Hosting + Cloud Run (یان VPS — هێشتا قسە لەسەر نەکراوە).
6. **A6 — هیچ DB migration ـی automated نییە** بۆ Firestore — schema changes بە دەست + script.
7. **A7 — ECC agents (٩) چالاکن**، بەڵام هیچ orchestration ـی automated نییە لە CI ـدا — هەموو بە دەست لە Copilot.
8. **A8 — "World-class" واتە: Odoo 19 Enterprise feature parity + Zoho One UX polish — نا custom AI/ML.**
9. **A9 — Budget/timeline ئاوا نەدراوە**؛ بۆیە complexity بە S/M/L/XL، نا بەروار.
10. **A10 — هیچ فایلێکی نوێ بۆ document نانووسرێت بەبێ داوای ڕاشکاوی بەکارهێنەر** (per رول).

---

# بەشی ١: AUDIT PLAN — پلانی چێککردنەوە

## ١.١ ڕێبازی Audit (Methodology)

هەر بەشێک بە ٣ ئاست ئاودیت دەکرێت:

| ئاست | چی دەکرێت | ئامراز / ئەیگێنت |
|------|-----------|-------------------|
| **L1 — Static** | code review، schema check، rule conformance | شادۆ ئاژێنت‌شیلد، Explore، grep |
| **L2 — Dynamic** | smoke test، sample data، replay scenarios | شادۆ تێستەر، زۆهۆ تێستەر، `test_all.py` |
| **L3 — Cross-reference** | بەراورد لەگەڵ Odoo 19 docs + Zoho Books behaviour | ERP Odoo Researcher، شادۆ دۆکس‌لووکەر |

**Sampling rule:** بۆ هەر مۆدوول ٣٠ ڕیکۆردی ڕاستەقینە (نا synthetic) بسەنجێ. بۆ accounting، minimum ١٠٠ journal entry لە ٣ مانگی جیا.

## ١.٢ Priority Order (یەکەم core ناوەڕۆک، پاشان فراوانی)

```
Tier 0  — Accounting integrity & data model         ← یەکەم، بێ ڕێگرتن
Tier 1  — Tax engine، multi-currency، period close
Tier 2  — Existing modules (Sales, Purchase, Inv, POS)
Tier 3  — Security، RBAC، Audit log
Tier 4  — Performance، UX، RTL، i18n
Tier 5  — Integrations، Reports، Dashboards
```

## ١.٣ Gap Analysis Table (٢٠ ڕیز — یەکەم core، پاشان modules)

> **Legend Priority:** P0 = blocker، P1 = critical، P2 = important، P3 = nice-to-have

### Tier 0 — Accounting Core

| # | بابەت | ئێستا (Zoho ERP) | Best-in-class (Odoo 19 / Zoho One) | Gap | Pri | Owner Agent |
|---|-------|------------------|-------------------------------------|-----|-----|-------------|
| 1 | Double-entry integrity | Journal entries CRUD، بەڵام validation کەمە | DB-level constraint: Σdebit == Σcredit، locked entries، gap-less numbering | Add server-side balance check + atomic Firestore transaction + sequence numbering | **P0** | زۆهۆ ئەکاونتینگ + زۆهۆ داتابەیس |
| 2 | Chart of Accounts | COA هەیە، tree structure | Multi-template (Iraq/IFRS/GAAP)، account types با subtypes (10+ types)، reconcilable flag | Add account templates + reconcilable + deprecated flags | P1 | زۆهۆ ئەکاونتینگ |
| 3 | Period Closing | `transaction_locking` API هەیە | Lock by date per journal، year-end close wizard، retained earnings auto-post | Year-end close service + retained earnings posting + reopen workflow | P1 | زۆهۆ ئەکاونتینگ |
| 4 | Multi-currency | Model هەیە، rate manual | Auto FX rate fetch، unrealized/realized gain-loss، revaluation report | FX rate provider + revaluation service + gain/loss accounts | P1 | زۆهۆ ئەکاونتینگ + ERP Integration |
| 5 | Tax Engine | Single-rate VAT 5%، withholding 5% | Tax groups، compound taxes، tax on tax، per-line tax، reverse charge، tax audit report | Refactor `taxes.py` to support tax groups + compound logic | P1 | ERP Localization Iraq + زۆهۆ ئەکاونتینگ |
| 6 | Bank Reconciliation | UI هەیە (قۆناغ ١.١) | Auto-match suggestions ML، reconciliation model، statement import (CSV/OFX/MT940) | Auto-match algorithm + statement format support | P2 | زۆهۆ ئەکاونتینگ |
| 7 | Audit Trail | `audit.py` بنیات هەیە | Immutable journal، who/what/when/before/after، signed log | Verify all entities write audit + add signature/hash chain | P1 | ERP Security + Audit |

### Tier 1-2 — Modules

| # | بابەت | ئێستا | Best-in-class | Gap | Pri | Owner |
|---|-------|-------|---------------|-----|-----|-------|
| 8 | Sales (Quote→SO→Invoice) | کاردەکات | Approval workflow، subscription invoicing، commission tracking | Workflow engine + subscriptions module | P2 | ERP Sales + Purchase |
| 9 | Purchase | کاردەکات | RFQ → vendor comparison → PO، landed costs، 3-way matching | 3-way match (PO ↔ Receipt ↔ Bill) + landed cost | P1 | ERP Sales + Purchase |
| 10 | Inventory | Warehouses + transfers | Lots/Serials، expiry، putaway/removal strategies، cycle counts، barcode | Lot/serial tracking + barcode UI + cycle count workflow | P1 | ERP Inventory + MRP |
| 11 | Manufacturing (MRP) | **نییە** | BOM، routings، work orders، MO scheduling، WIP accounting | Build MRP module from scratch | P2 | ERP Inventory + MRP |
| 12 | POS | ١١٠ endpoint، ١٨ page | Offline-first PWA، loyalty، gift cards، restaurant table mgmt | Verify offline sync correctness + loyalty edge cases | P2 | ERP POS |
| 13 | HR + Payroll | بنەڕەتی | Iraq payroll formulae، social security، leave types، appraisals | Build Iraq payroll engine | P2 | ERP HR + Payroll + ERP Localization Iraq |
| 14 | CRM | بنەڕەتی | Pipeline Kanban، email tracking، lead scoring، WhatsApp integration | Build full CRM + integration | P2 | ERP CRM + ERP Integration |
| 15 | E-commerce / Website | **نییە** | Online storefront، CMS، checkout linking to ERP | Build e-commerce module (post-MVP) | P3 | ERP E-commerce |
| 16 | Project + Timesheets | کاردەکات | Gantt، billable hours auto-invoice، forecast | Add Gantt + auto-bill | P3 | ERP Project + Timesheet |
| 17 | Reports | ١٢ report | Pivot، custom report builder، scheduled email، PDF/Excel | Add report builder + scheduling | P2 | زۆهۆ ئەکاونتینگ + شادۆ ئەدا |
| 18 | RBAC | کاردەکات | Field-level permissions، record rules، multi-role، delegation | Field-level RBAC + record rules | P1 | ERP Security + Audit |
| 19 | Performance | بێ profiling | p95 < 300ms، Firestore query budget، N+1 detection | Add observability + profile hot paths | P2 | شادۆ ئەدا |
| 20 | i18n / RTL | کوردی + ئینگلیزی | کوردی، عەرەبی، ئینگلیزی، تورکی، ٣٠٠٠+ keys | Add Arabic + Turkish + audit missing keys | P3 | شادۆ ناوەڕۆک |

## ١.٤ Verification بۆ هەر بەشێک

| ئاست | چۆن دڵنیا دەبین Audit دروستە؟ |
|------|--------------------------------|
| Static | شادۆ ئاژێنت‌شیلد scan = 0 critical/high; type errors = 0 |
| Dynamic | `test_all.py` PASS rate = 100%؛ smoke scenarios PASS |
| Cross-ref | بەراورد ٣ feature لەگەڵ Odoo docs لە هەر مۆدوول، document gap |
| Sampling | ١٠٠ journal entry: Σdebit == Σcredit بۆ هەمووی |
| User QA | بەکارهێنەر تاقی بکات ٥ scenario لە production-like data |

---

# بەشی ٢: GROW PLAN — پلانی تۆکمەکردن (١٤ قۆناغ)

> **خوێندنەوە:** هەر قۆناغ ئەم structure ـی هەیە:
> Goal → Owner → Support → Skills → Verification → Test → Complexity → Dependencies → DoD → Rollback

---

### قۆناغ ٠ — Accounting Audit & Hardening (P0)

- **Goal (verifiable):** ١٠٠٪ ی journal entries balanced; gap-less sequence; audit log بۆ هەموو write operations.
- **Owner:** زۆهۆ ئەکاونتینگ
- **Support:** زۆهۆ داتابەیس، ERP Security + Audit، شادۆ ئاژێنت‌شیلد
- **Skills:** `firestore-patterns`، `python-patterns`، `security-review-owasp`، `tdd-workflow`، `karpathy-guidelines`، `verification-loop`
- **Verification:** Script ـی Python بەسەر هەموو `journal_entries` بڕوا، balance check + sequence gap check بکا. AgentShield = 0 critical.
- **Test:** زۆهۆ تێستەر — 30 سیناریۆی journal (post، reverse، delete-locked، unbalanced reject، concurrent post).
- **Complexity:** L
- **Dependencies:** هیچ
- **DoD:** Balance script PASS، sequence script PASS، 30 tests GREEN، instinct نووسرا لە `/memories/instincts/accounting.md`.
- **Rollback:** هیچ destructive — تەنها validation زیاد دەکرێت. ئەگەر invalid data دۆزرایەوە، report بدە، نا auto-fix.

### قۆناغ ١ — Tax Engine v2 (P1)

- **Goal:** Tax groups، compound tax، per-line override، Iraq VAT + withholding صحیح.
- **Owner:** ERP Localization Iraq
- **Support:** زۆهۆ ئەکاونتینگ، زۆهۆ باکئێند
- **Skills:** `python-patterns`، `firestore-patterns`، `api-design-fastapi`، `tdd-workflow`
- **Verification:** ٢٠ invoice ـی sample بە مەیناژێی tax cases (single, group, compound, reverse charge) — ژمێرکاری دەستی بەراورد.
- **Test:** زۆهۆ تێستەر — endpoint tests + tax calculation unit tests.
- **Complexity:** M
- **Deps:** قۆناغ ٠
- **DoD:** Tax report لە `Reports.tsx` ڕاپۆرتی VAT 100% accurate.
- **Rollback:** Feature flag `TAX_ENGINE_V2` لە config — fallback بۆ v1.

### قۆناغ ٢ — Multi-currency Revaluation (P1)

- **Goal:** FX rate auto-fetch (daily)، unrealized gain/loss، monthly revaluation entry.
- **Owner:** زۆهۆ ئەکاونتینگ
- **Support:** ERP Integration (FX provider)، زۆهۆ باکئێند
- **Skills:** `python-patterns`، `firestore-patterns`، `documentation-lookup`
- **Verification:** Revaluation entry حسێبکراو بە دەست بۆ ٣ ماوە، بەراورد لەگەڵ outputی سیستەم.
- **Test:** زۆهۆ تێستەر — unit tests for FX math، endpoint tests.
- **Complexity:** L
- **Deps:** قۆناغ ٠، قۆناغ ١
- **DoD:** Revaluation report نوێ، gain/loss accounts auto-created.
- **Rollback:** Disable cron + delete revaluation entries (مارک کراون).

### قۆناغ ٣ — Period Close & Year-End (P1)

- **Goal:** Wizard بۆ year-end close، retained earnings auto-post، reopen flow.
- **Owner:** زۆهۆ ئەکاونتینگ
- **Support:** زۆهۆ فرۆنتئێند، ERP Security + Audit
- **Skills:** `react19-patterns`، `antd-rtl-patterns`، `python-patterns`
- **Verification:** Manual scenario: close FY2025، open FY2026، retained earnings = sum(P&L 2025).
- **Test:** زۆهۆ تێستەر + شادۆ تێستەر (frontend wizard).
- **Complexity:** M
- **Deps:** قۆناغ ٠
- **DoD:** Wizard کاردەکات، locking بەکاردێت، reopen audit-logged.
- **Rollback:** Reopen action.

### قۆناغ ٤ — Inventory: Lots, Serials, Barcode (P1)

- **Goal:** Lot/serial tracking بۆ items، expiry alerts، barcode scan لە POS و inventory.
- **Owner:** ERP Inventory + MRP
- **Support:** ERP POS، زۆهۆ فرۆنتئێند
- **Skills:** `firestore-patterns`، `react19-patterns`، `tdd-workflow`
- **Verification:** Stock movement لەگەڵ lot tracking، query "where is lot X" → result accurate.
- **Test:** شادۆ تێستەر e2e + زۆهۆ تێستەر API.
- **Complexity:** L
- **Deps:** قۆناغ ٠
- **DoD:** Item ـێک hostable as lot-tracked، barcode scan لە POS کاردەکات.
- **Rollback:** Feature flag `INV_LOTS`.

### قۆناغ ٥ — Purchase: 3-Way Match & Landed Costs (P1)

- **Goal:** Validate Bill against PO + Goods Receipt; landed cost allocation.
- **Owner:** ERP Sales + Purchase
- **Support:** زۆهۆ ئەکاونتینگ، ERP Inventory + MRP
- **Skills:** `python-patterns`، `firestore-patterns`
- **Verification:** Mismatch scenario triggers warning + block; landed cost increases item average cost.
- **Test:** زۆهۆ تێستەر — 10 scenarios.
- **Complexity:** M
- **Deps:** قۆناغ ٤
- **DoD:** Mismatch report، landed cost wizard.
- **Rollback:** Feature flag `PUR_3WAY`.

### قۆناغ ٦ — RBAC v2: Field-level + Record Rules (P1)

- **Goal:** ڕۆڵەکان توانای دیتنی فیلدی دیاری/recordی دیاری بسنوورن.
- **Owner:** ERP Security + Audit
- **Support:** زۆهۆ باکئێند، زۆهۆ فرۆنتئێند
- **Skills:** `security-review-owasp`، `agentshield-rules`، `python-patterns`
- **Verification:** ٥ ڕۆڵ تاقی بکە، AgentShield scan + auth bypass tests.
- **Test:** شادۆ ئاژێنت‌شیلد + زۆهۆ تێستەر.
- **Complexity:** L
- **Deps:** قۆناغ ٠
- **DoD:** UI لاپەڕەی Roles بە field-level دەکات، APIs respect rules.
- **Rollback:** Disable middleware؛ کۆنە RBAC active.

### قۆناغ ٧ — Manufacturing (MRP) MVP (P2)

- **Goal:** BOM، work orders، simple scheduling، WIP accounting.
- **Owner:** ERP Inventory + MRP
- **Support:** زۆهۆ ئەکاونتینگ، ERP Sales + Purchase
- **Skills:** `python-patterns`، `firestore-patterns`، `react19-patterns`
- **Verification:** Build a simple BOM، launch MO، consume raw، produce finished، journal entries auto.
- **Test:** زۆهۆ تێستەر + شادۆ تێستەر e2e.
- **Complexity:** XL
- **Deps:** قۆناغ ٤، قۆناغ ٥
- **DoD:** ٢ لاپەڕەی نوێ (BOMs، Work Orders)، API ~٢٥ endpoint.
- **Rollback:** Module disable flag — هیچ کاریگەری لەسەر بەشی تر.

### قۆناغ ٨ — HR + Payroll (Iraq) (P2)

- **Goal:** Employees، attendance، Iraq payroll engine، payslips PDF.
- **Owner:** ERP HR + Payroll
- **Support:** ERP Localization Iraq، زۆهۆ ئەکاونتینگ
- **Skills:** `python-patterns`، `firestore-patterns`، `pdf RTL` (لە backend)
- **Verification:** ١٠ payslip تاقی بکە، taxation + social security دروست.
- **Test:** زۆهۆ تێستەر.
- **Complexity:** XL
- **Deps:** قۆناغ ١، قۆناغ ٠
- **DoD:** Payslip PDF لە کوردی، journal entry auto-post.
- **Rollback:** Module disable.

### قۆناغ ٩ — CRM + WhatsApp/Email Integration (P2)

- **Goal:** Pipeline Kanban، lead → opportunity → quote، WhatsApp Business API + email tracking.
- **Owner:** ERP CRM
- **Support:** ERP Integration، ERP Marketing
- **Skills:** `react19-patterns`، `antd-rtl-patterns`، `documentation-lookup`
- **Verification:** End-to-end lead → quote → invoice; WhatsApp message logged.
- **Test:** شادۆ تێستەر e2e + زۆهۆ تێستەر.
- **Complexity:** L
- **Deps:** قۆناغ ٠
- **DoD:** Kanban UI، integration وەرگرتن/ناردن.
- **Rollback:** Module disable + revoke WhatsApp token.

### قۆناغ ١٠ — Reports v2: Pivot + Builder + Scheduling (P2)

- **Goal:** Drag-drop report builder، pivot، scheduled email PDF/Excel.
- **Owner:** زۆهۆ ئەکاونتینگ
- **Support:** شادۆ ئەدا، شادۆ فرۆنتئێند
- **Skills:** `python-patterns`، `react19-patterns`
- **Verification:** Build 3 custom reports؛ schedule weekly email؛ check delivery.
- **Test:** شادۆ تێستەر.
- **Complexity:** L
- **Deps:** قۆناغ ٠
- **DoD:** ٣ ڕاپۆرتی نوێ بە builder، scheduler کاردەکات.
- **Rollback:** Disable scheduler.

### قۆناغ ١١ — Performance & Observability (P2)

- **Goal:** p95 API < 300ms; query budget per endpoint; structured logging + metrics dashboard.
- **Owner:** شادۆ ئەدا
- **Support:** ERP DevOps، شادۆ هارنیس
- **Skills:** `token-optimization`، `cost-aware-pipeline`، `firestore-patterns`
- **Verification:** Load test (k6 or Locust): 50 concurrent users، measure p95.
- **Test:** شادۆ تێستەر perf scenarios.
- **Complexity:** M
- **Deps:** قۆناغ ٠ (ئاسایی)، باشترە دوای feature stabilization
- **DoD:** Dashboard metrics live، 5 hot paths optimized.
- **Rollback:** هیچ — تەنها instrumentation.

### قۆناغ ١٢ — Security Hardening + Pentest (P1)

- **Goal:** AgentShield 0 critical/high; OWASP Top 10 fully covered; pentest report.
- **Owner:** شادۆ ئاژێنت‌شیلد
- **Support:** ERP Security + Audit، شادۆ
- **Skills:** `agentshield-rules`، `security-review-owasp`
- **Verification:** Full repo scan + manual pentest scenarios (auth bypass، IDOR، SSRF، injection).
- **Test:** شادۆ ئاژێنت‌شیلد automated + manual.
- **Complexity:** M
- **Deps:** قۆناغ ٦
- **DoD:** Report + 0 critical findings.
- **Rollback:** هیچ.

### قۆناغ ١٣ — UX Polish + i18n Expansion (Arabic, Turkish) (P3)

- **Goal:** ٤ زمان (ku, en, ar, tr)، RTL polish، dark/light mode، PWA.
- **Owner:** ERP UX Designer
- **Support:** شادۆ ناوەڕۆک، زۆهۆ فرۆنتئێند
- **Skills:** `antd-rtl-patterns`، `react19-patterns`، `typescript-strict`
- **Verification:** ٤ زمان لە هەموو لاپەڕە تاقی، missing keys = 0.
- **Test:** شادۆ تێستەر visual + accessibility.
- **Complexity:** L
- **Deps:** قۆناغەکانی پێشوو ئاسایی نییە، بەڵام جواندنە
- **DoD:** ٤ زمان شیپ، PWA installable.
- **Rollback:** Disable language toggle.

## ٢.١ Cross-Cutting Concerns (لە هەر قۆناغ)

| Concern | Agent | کاتێک |
|---------|-------|-------|
| **Security scan** | شادۆ ئاژێنت‌شیلد | پێش هەر commit، دوای هەر قۆناغ |
| **Performance check** | شادۆ ئەدا | دوای feature merge |
| **Docs update** | شادۆ دۆکیومێنتەر | دوای DoD |
| **Memory/instinct** | شادۆ کۆچ + شادۆ مێمۆری | دوای retro هەر قۆناغ |
| **Skill creation** | شادۆ سکیڵ‌میکەر | ئەگەر pattern نوێ دۆزرایەوە |
| **Cost optimization** | شادۆ هارنیس | لە planner phase + post-build review |

## ٢.٢ Orchestration (شادۆ ئۆرکێسترەیتەر چۆن کار دەکات)

- **Sequential phases** (٠ → ١ → ٢ → ٣): بۆ accounting tier زنجیرەیی، بێ parallel.
- **Parallel-safe phases:** قۆناغ ٧ (MRP) + قۆناغ ٨ (HR) + قۆناغ ٩ (CRM) دەکرێ یەکجار بەڕێوەبچن (هیچ shared schema dependency).
- **Always-on agents:** شادۆ ئاژێنت‌شیلد + شادۆ کۆچ + شادۆ مێمۆری لە background.
- **Loop pattern:** هەر قۆناغ:
  `پلانساز → developer → tester → AgentShield → eval → memory → docs`

---

# بەشی ٣: EXECUTION FRAMEWORK

## ٣.١ Verification Loop (لە هەر قۆناغ)

```
Plan      ← شادۆ پلانساز (یان ERP-specific)
  ↓
Build     ← دەڤەلۆپەر (زۆهۆ یان ERP-specific)
  ↓
Test      ← زۆهۆ تێستەر / شادۆ تێستەر — must PASS
  ↓
Security  ← شادۆ ئاژێنت‌شیلد — 0 critical
  ↓
Eval      ← شادۆ ئیڤاڵ — grade against goal
  ↓
Commit    ← Git commit + AgentShield pre-commit hook
  ↓
Memory    ← شادۆ کۆچ — instinct، شادۆ سکیڵ‌میکەر — skill update
  ↓
Docs      ← شادۆ دۆکیومێنتەر — auto-update relevant docs
```

## ٣.٢ Definition of Done (هەر تاسک)

- [ ] Code merged + `npm run build` PASS (نا تەنها `tsc --noEmit`)
- [ ] Backend `test_all.py` PASS rate ≥ goal
- [ ] AgentShield scan 0 critical/high
- [ ] i18n keys زیادکراون لە `ku.json` + `en.json`
- [ ] هیچ `any` لە TypeScript، هیچ magic number
- [ ] Audit log entry بۆ هەموو write API
- [ ] RTL ـی AntD checked manually
- [ ] Memory instinct نووسرا (ئەگەر pattern نوێ)
- [ ] Goal verifiable و verified

## ٣.٣ Rollback Strategy

| Scenario | Action |
|----------|--------|
| Backend regression | `git revert <sha>` + redeploy + post-mortem لە `/memories/instincts/regressions.md` |
| Firestore data corruption | Restore لە backup (ئەگەر هەیە — ئەگەر نا، **مەسەلەی P0** بۆ DevOps) |
| Frontend break | Vite rollback + `git revert` + clear CDN cache |
| Failed migration script | Idempotent rerun + dry-run mode هەمیشە یەکەم |
| Feature flag failure | Toggle off لە config، redeploy |

> **Karpathy:** هیچ "auto-fix" بۆ data corruption بە دەست؛ بێدەنگ مەهێڵە؛ alert بدە.

## ٣.٤ Memory & Learning Loop

دوای هەر قۆناغ:
1. **شادۆ کۆچ** retro دەکا و instinct دەنووسێت (`/memories/instincts/<topic>.md`).
2. **شادۆ سکیڵ‌میکەر** ئایا pattern نوێ هاتە دەرەوە؟ ئەگەر بەڵێ، skill draft.
3. **شادۆ مێمۆری** repo memory (`/memories/repo/zoho-project.md`) updateدەکا بە verified facts.
4. Old/incorrect instincts بسڕە یا revise بکە.

## ٣.٥ Reporting بۆ بەکارهێنەر

دوای هەر قۆناغ بەکورتی بە کوردی:

```
## ڕاپۆرتی قۆناغ X — <ناو>
- ✅ ئەنجامدراو: [3 خاڵ سەرەکی]
- 📊 KPI: [test pass %, AgentShield, perf]
- ⚠️  ڕیسک: [3 خاڵ]
- 🧠 فێربوون: [instinct/skill نوێ]
- ⏭️  قۆناغی داهاتوو: <ناو> + dependencies
```

---

# ئاپێندیکس A — لیستی ئەیگێنتی بەکارهێنراو لە پلان

**ERP-specific:** ERP Brain، ERP CRM، ERP DevOps، ERP HR + Payroll، ERP Integration، ERP Inventory + MRP، ERP Localization Iraq، ERP Marketing، ERP Odoo Researcher، ERP POS، ERP Project + Timesheet، ERP Sales + Purchase، ERP Security + Audit، ERP UX Designer، زۆهۆ ئەکاونتینگ، زۆهۆ باکئێند، زۆهۆ داتابەیس، زۆهۆ فرۆنتئێند، زۆهۆ تێستەر.

**Generic:** شادۆ پلانساز، شادۆ تێستەر، شادۆ ئەدا، شادۆ ناوەڕۆک، شادۆ.

**ECC:** شادۆ مێمۆری، شادۆ کۆچ، شادۆ ئاژێنت‌شیلد، شادۆ هارنیس، شادۆ ئیڤاڵ، شادۆ ئۆرکێسترەیتەر، شادۆ دۆکیومێنتەر، شادۆ سکیڵ‌میکەر، شادۆ دۆکس‌لووکەر.

# ئاپێندیکس B — لیستی سکیڵی بەکارهێنراو

`karpathy-guidelines`، `verification-loop`، `tdd-workflow`، `python-patterns`، `firestore-patterns`، `api-design-fastapi`، `typescript-strict`، `react19-patterns`، `antd-rtl-patterns`، `security-review-owasp`، `agentshield-rules`، `continuous-learning-v2`، `strategic-compact`، `token-optimization`، `cost-aware-pipeline`، `documentation-lookup`، `autonomous-loops`.

---

## 🎯 پێشنیاری دەستپێکردن

| بابەت | بەها |
|------|------|
| **ژمارەی قۆناغ** | ١٤ (٠ تا ١٣) |
| **Gap analysis rows** | ٢٠ |
| **Priority distribution** | P0: 1، P1: 7، P2: 5، P3: 1 |
| **Recommended first phase** | **قۆناغ ٠ — Accounting Audit & Hardening** (P0 — هیچ feature ـی نوێ پێش ئەمە) |
| **هۆکار** | Accounting integrity = پارە. هەر هەڵەیەک لێرە compounded دەبێت لە هەر مۆدوولی پاشان. |
