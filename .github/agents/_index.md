# 🤖 Master Agent Index

> ئەم فایلە **هەموو شادۆ ئەیگێنتەکانی** بەردەست لە سیستەم لیست دەکات.
> پلانساز پێویستە ئەم فایلە **پێش هەر پلاندانان** بخوێنێتەوە.

---

## A. ERP-specific Agents (٢٣ ئێستا)

| ئەیگێنت | شارەزایی | کاتێک بەکار دێت |
|----------|------------|------------------|
| `ERP Brain` | Orchestration + کۆ‌پلان | بنیاتنانی تەواوی ERP، coordination |
| `ERP CRM` | CRM module | leads، opportunities، pipeline، Kanban |
| `ERP DevOps` | Deployment + monitoring | CI/CD، Docker، backup، rollback |
| `ERP E-commerce` | Online store + website | catalog، cart، checkout، CMS |
| `ERP HR + Payroll` | HR module | employees، attendance، payroll، payslips |
| `ERP Integration` | External APIs | WhatsApp، OCR، payment gateways |
| `ERP Inventory + MRP` | Inventory + manufacturing | stock، BOM، work orders، lots |
| `ERP Localization Iraq` | Iraq compliance | VAT، withholding، IQD، Kurdish |
| `ERP Marketing` | Email/SMS marketing | campaigns، automation، surveys |
| `ERP Migration` | Data import | Excel، CSV، QuickBooks، Zoho، Odoo |
| `ERP Odoo Researcher` | Odoo docs lookup | research Odoo features، gap analysis |
| `ERP POS` | Point of Sale | cashier، sessions، restaurant، loyalty |
| `ERP Project + Timesheet` | PM + time tracking | tasks، Gantt، billable hours |
| `ERP Sales + Purchase` | Sales/Purchase orders | quote-to-cash، RFQ، delivery |
| `ERP Security + Audit` | RBAC + audit | roles، permissions، 2FA، GDPR |
| `ERP UX Designer` | UI/UX | dark mode، dashboard، PWA، templates |
| `زۆهۆ ئەکاونتینگ` | Accounting logic | journal entries، COA، tax |
| `زۆهۆ باکئێند` | Backend dev | FastAPI، endpoints، Python |
| `زۆهۆ مێشک` | Orchestrator | full features end-to-end |
| `زۆهۆ داتابەیس` | DB schema | SQLAlchemy، migrations، Firestore |
| `زۆهۆ فرۆنتئێند` | Frontend dev | React، AntD، RTL، pages |
| `زۆهۆ ریسێرچەر` | Feature research | Zoho Books gap analysis |
| `زۆهۆ تێستەر` | Backend QA | endpoints، test_all.py، smoke |

---

## B. Generic Agents (١٣ موجود)

| ئەیگێنت | شارەزایی |
|----------|------------|
| `شادۆ مێشک` | Master orchestrator |
| `شادۆ پلانساز` | Architect + planner |
| `شادۆ دەڤەلۆپەر` | Full-stack developer |
| `شادۆ تێستەر` | QA + testing |
| `شادۆ ئەدا` | Web performance + SEO |
| `شادۆ داتابەیس` | Supabase + Postgres + Firestore |
| `شادۆ DevOps` | Deployment |
| `شادۆ دیزاینەر` | Frontend design + animations |
| `شادۆ ناوەڕۆک` | i18n + translation |
| `شادۆ سۆشیال` | Social media marketing |
| `شادۆ` | Full audit (security، SEO، perf، compliance) |
| `graphic-designer` | Logos، branding، print |
| `Explore` | Read-only codebase exploration |

---

## C. ECC Integration Agents (٩ چالاک)

| ئەیگێنت | شارەزایی | لە کام سپرینت | ECC source |
|----------|------------|---------------|------------|
| `شادۆ مێمۆری` | `/memories/` orchestration | Sprint 2 | memory-keeper |
| `شادۆ کۆچ` | Continuous Learning v2 | Sprint 2 | instinct-extractor + skill-evolver |
| `شادۆ ئاژێنت‌شیلد` | Security scanning (102 rules) | Sprint 3 | security-reviewer + agentshield-runner |
| `شادۆ هارنیس` | Token/cost/context optimization | Sprint 4 | harness-optimizer + prompt-compactor |
| `شادۆ ئیڤاڵ` | Verification + grading | Sprint 5 | eval-harness + verification-loop |
| `شادۆ ئۆرکێسترەیتەر` | Multi-agent loops | Sprint 6 | loop-operator + chief-of-staff |
| `شادۆ دۆکیومێنتەر` | Auto doc updates | Sprint 7 | doc-updater |
| `شادۆ دۆکس‌لووکەر` | Live docs lookup | Sprint 7 | docs-lookup + Context7 |
| `شادۆ سکیڵ‌میکەر` | Skill creation/evolution | Sprint 7 | skill-author + skill-evolver |

---

## 🧭 ڕێبەری Routing بۆ پلانساز

پلانساز پێش پلاندانان پرسیار لە خۆی بکات:

١. **چ گرووپ ـی task ـە؟** (backend / frontend / DB / DevOps / security / docs / learning / multi-module)
٢. **کام ئەیگێنت پسپۆڕە لە ئەو گرووپە؟** (لە A یان B یان C ـی سەرەوە)
٣. **چ سکیڵە پێویستن؟** (بۆ skills [_index.md](../skills/_index.md) ببینە)
٤. **چ رولانە پابەستن؟** (بۆ rules [_index.md](../rules/_index.md) ببینە)
٥. **ئایا چەند ئەیگێنت پێویستن (orchestration)؟** (شادۆ ئۆرکێسترەیتەر بەکار بهێنە)

---

## 📊 Coverage Matrix (workflow → agent)

| Workflow | Primary | Support | Reviewer |
|----------|---------|---------|----------|
| Feature development | شادۆ پلانساز | شادۆ دەڤەلۆپەر | شادۆ تێستەر |
| Bug fix | شادۆ تێستەر (reproduce) | شادۆ دەڤەلۆپەر (fix) | شادۆ تێستەر (verify) |
| Refactor | شادۆ دەڤەلۆپەر | — | شادۆ تێستەر |
| Security audit | شادۆ ئاژێنت‌شیلد | شادۆ | شادۆ تێستەر |
| Performance | شادۆ ئەدا (web) / شادۆ هارنیس (LLM) | — | شادۆ ئیڤاڵ |
| ERP module new | ERP Brain | ERP <module> | شادۆ تێستەر |
| Iraq feature | ERP Localization Iraq | ERP <module> | شادۆ تێستەر |
| POS feature | ERP POS | شادۆ دەڤەلۆپەر | شادۆ تێستەر |
| Documentation | شادۆ دۆکیومێنتەر | شادۆ دۆکس‌لووکەر | — |
| Learning | شادۆ کۆچ | شادۆ مێمۆری | — |
| Multi-agent loop | شادۆ ئۆرکێسترەیتەر | (multiple) | شادۆ ئیڤاڵ |
