# Zoho ERP — Copilot Instructions (Master)

> ئەم فایلە **خۆکار** بۆ هەموو Copilot Chat session ـەکان لە workspace ـی `c:\Users\SAFA\zoho` بارگاو دەکرێت.
> هەموو ئەیگێنت، سکیڵ، رول، و کۆماند لە سیستەمی شادۆ پابەستن بە ئەم فایلە.

---

## 🎯 پرۆژە

**Zoho ERP** = Zoho Books clone + کامڵبوون بۆ Odoo-style ERP.

---

## 🧠 Always-On Behavioral Skill

لە هەر داواکارییەکدا، بە تایبەتی task ـە non-trivial ـەکان، ئەم skill ـە **هەمیشە چالاکە**:

- `.github/skills/meta/karpathy-guidelines.md`

ئەمە واتە Copilot و هەموو ئەیگێنتەکان پێویستە هەمیشە ئەم ٤ بنەمایە جێبەجێ بکەن:

1. **Think Before Coding**
    هەر کات ambiguity هەبێت، assumption مەکە. ئەگەر دوو شێوازی لێکدانەوە هەبێت، ڕوونیان بکەوە و ئەوەی گرنگە دابنێ.
2. **Simplicity First**
    کەمترین کۆدی پێویست بنووسە. هیچ abstraction، flexibility، یان feature ـێکی زیاد لە داواکراو مەزیاد مەکە.
3. **Surgical Changes**
    تەنها ئەو هێڵانە بگۆڕە کە ڕاستەوخۆ بە task ـەکەوە پەیوەستن. Drive-by refactor، formatting drift، و "هەروەها ئەمەشم باش کرد" قەدەغەیە.
4. **Goal-Driven Execution**
    task ـەکە بگۆڕە بۆ ئامانجی تاقیکراوە: reproduce → fix → verify. بۆ کارە سادەکان، judgment بەکاربهێنە و workflow ـەکە قورس مەکە.

**Rule:** ئەگەر داواکارییەک ڕوون نەبێت، clarify بکە پێش implementation. ئەگەر داواکارییەک ڕوون بێت، بە کەمترین گۆڕانکاری و verification بڕۆ.

### Stack
- **Backend:** Python 3.11 + FastAPI + Firebase Admin + Firestore
- **Frontend:** React 19 + TypeScript + Vite 8 + Ant Design 6.3.5 (RTL) + Zustand 5 + i18next
- **Auth:** Firebase Auth + JWT (jose) + bcrypt
- **زمانی سەرەکی:** کوردی (ckb) — هەموو UI و پلانەکان کوردی
- **OS:** Windows 11 + PowerShell 5.1

### دۆخی ئێستا (Apr 2026)
- ✅ Zoho Books clone تەواو (invoices, bills, COA, journals, ...)
- ✅ Iraq localization (VAT, withholding, IQD)
- ✅ RBAC + Audit log
- ✅ POS module (~110 endpoints, 18 pages)
- ✅ ECC integration foundation complete (٧ سپرینت تەواون)

---

## 📂 ستراکچەری Workspace

```
c:\Users\SAFA\zoho\
├─ backend/                          ← FastAPI + Firestore
│  ├─ app/
│  │  ├─ api/                        ← REST routes
│  │  ├─ firestore/                  ← Repositories (BaseRepository pattern)
│  │  ├─ services/                   ← Business logic
│  │  ├─ middleware/                 ← Audit + auth
│  │  └─ schemas/                    ← Pydantic models
│  ├─ venv/                          ← Python 3.11 venv
│  └─ test_all.py                    ← Smoke test runner
├─ frontend/                         ← React 19 + Vite + AntD RTL
│  └─ src/
│     ├─ pages/                      ← Route pages
│     ├─ components/                 ← Shared UI
│     ├─ store.ts + store/           ← Zustand
│     ├─ locales/                    ← en.json + ku.json
│     └─ api.ts                      ← axios client
├─ .github/
│  ├─ agents/                        ← ٣٢ ئەیگێنت (.agent.md + _index.md)
│  ├─ skills/                        ← سکیڵەکان + _index.md
│  ├─ rules/                         ← always-follow rules
│  ├─ scripts/                       ← PowerShell helpers
│  └─ copilot-instructions.md        ← ئەم فایلە
└─ /memories/                        ← Copilot memory (auto)
```

---

## ⚙️ Commands گرنگ (Windows PowerShell)

```powershell
# Backend
c:\Users\SAFA\zoho\backend\venv\Scripts\python.exe -m uvicorn app.main:app `
    --port 8000 --log-level warning --app-dir c:\Users\SAFA\zoho\backend

# Frontend
cd c:\Users\SAFA\zoho\frontend
npm run dev          # development
npm run build        # production build (tsc -b && vite build)
npx tsc --noEmit     # quick TS check (NOT enough — use npm run build for full check)

# Test
cd c:\Users\SAFA\zoho\backend
venv\Scripts\python.exe test_all.py
```

### Auth (تێست)
- Email: `admin@test.com`
- Password: `123456`
- org_id: `0487e3e8-60e9-4824-b288-c0042f48b078`
- Password (prod): `Admin@12345` (8+ chars required by API)

---

## 🛡️ Always-Follow Rules

ئەم رولانە لە `.github/rules/*.md` تەواوتر شیکراون. بەکورتی:

### کۆد
- **Type safety:** Python type hints + TypeScript strict (no `any`)
- **No magic numbers:** هەموو constant ـەکان named
- **Error handling:** سنوورەکان (API/DB/file) تەنها — نا داخلی
- **No over-engineering:** تەنها ئەو شتە کە داوا کراوە

### کوردی + RTL
- هەموو UI string لە `frontend/src/locales/ku.json` + `en.json`
- AntD `direction="rtl"` خۆکار کاردەکات
- Divider بەکارهێنە `titlePlacement` نا `orientation` (AntD 6.3+)
- `Tag` بێ `size` (لابراوە لە AntD 6)

### PowerShell
- ❌ هیچ `&&` (PowerShell 5.1 پشتی ناگرێت) — `;` بەکار بهێنە
- ❌ هیچ em-dash (—) لە script
- ✅ absolute path بۆ `venv\Scripts\python.exe`
- ✅ `Select-String` لەباتی `grep`

### Firestore
- هەموو filtering لە Python (نا composite indexes)
- BaseRepository pattern (`backend/app/firestore/base.py`)
- هەموو فایل `org_id`-scoped

### Git
- Commit پەیام بە کوردی یان English (consistent)
- هیچ `--no-verify`، هیچ `--force` بێ ڕەزامەندی

### Security (OWASP Top 10)
- هیچ secret لە کۆد
- SQL/NoSQL injection guard (parameterized queries)
- Input validation لە سنوور (Pydantic)
- Auth check لە هەر endpoint

---

## � RTK Token Optimization (v0.37.2 — Windows Native)

**RTK** (Rust Token Killer) دامەزراوە لە `%USERPROFILE%\tools\rtk\rtk.exe` و چالاکە بۆ Copilot لە VS Code.
لە v0.37.2 ـدا Windows native hook پشتگیریکراوە — بەڵام حتی ئەگەر hook پەیوەند بکات، بۆ پشت‌ڕاستکردنەوە، **هەر کات terminal command دەنووسیت کە RTK پشتگیری دەکات و non-interactive ـە، `rtk` ـی پێشوەخت زیاد بکە**.

### Hook config
- `.github/hooks/rtk-rewrite.json` (PreToolUse → `rtk hook copilot`)
- ڕیستارت VS Code پێویستە بۆ چالاککردن

### Rule بۆ Copilot agents
1. سەرەتا `Get-Command rtk -ErrorAction SilentlyContinue` چێک بکە (یەکجار، cache بکە)
2. ئەگەر هەبوو → فەرمانەکان بە `rtk` پێشوەخت بنووسە
3. ئەگەر نەبوو → raw command بە بێ error بەردەوام بە

### نموونە
```powershell
# ✅ باش
rtk git status
rtk git log --oneline -50
rtk git diff
cd c:\Users\SAFA\zoho\frontend; rtk npm run build
rtk c:\Users\SAFA\zoho\backend\venv\Scripts\python.exe c:\Users\SAFA\zoho\backend\test_all.py

# ❌ مەکە (long-running / interactive)
rtk uvicorn ...
rtk npm run dev
rtk python   # REPL
```

### PowerShell wrappers (optional)
بۆ بەکارهێنەر، load بکە: `. c:\Users\SAFA\zoho\.github\scripts\rtk-wrappers.ps1`
تابعەکان: `rtkgit`, `rtknpm`, `rtktsc`, `rtkbuild`, `rtkpytest`, `rtktestall`, `rtkbackend`, `rtkgain`

### Reporting
- `rtk gain` — کۆی token savings
- `rtk gain --history` — مێژووی فەرمانەکان

### سکیڵی تەواو
بۆ command mapping تەواو + decision tree، بڕوانە: `.github/skills/harness/rtk-token-optimization.md`

---

## �🤖 شادۆ ئەیگێنت‌ـە بەردەستەکان

### ERP-specific (٢٣ ئێستا)
ERP Brain, ERP CRM, ERP DevOps, ERP E-commerce, ERP HR, ERP Integration, ERP Inventory, ERP Localization Iraq, ERP Marketing, ERP Migration, ERP Odoo Researcher, ERP POS, ERP Project, ERP Sales, ERP Security, ERP UX, زۆهۆ ئەکاونتینگ، باکئێند، مێشک، داتابەیس، فرۆنتئێند، ریسێرچەر، تێستەر.

### Generic (١٣ بەردەست)
شادۆ مێشک، پلانساز، دەڤەلۆپەر، تێستەر، ئەدا، داتابەیس، DevOps، دیزاینەر، ناوەڕۆک، سۆشیال، شادۆ، graphic-designer، Explore.

### ECC-integrated (٩ چالاک)
شادۆ مێمۆری، کۆچ، ئاژێنت‌شیلد، هارنیس، ئیڤاڵ، ئۆرکێسترەیتەر، دۆکیومێنتەر، دۆکس‌لووکەر، سکیڵ‌میکەر.

### Default Pool — Enterprise + Generic (٤٥ ئەیگێنت + ٤٥ checker — May 2026)

> هاوردە کراون لە `C:\Users\SAFA\OneDrive\Desktop\agents` بۆ `.github/agents/shadow-*.agent.md`.
> **Default routing rule:** هەر تاسکێکی نوێ → سەرەتا `shadow-brain` (Master Orchestrator) → خۆی planner / executor / specialist ـەکان دەنێرێت.

**Orchestration Pool:** `shadow-brain`, `shadow-planner`, `shadow-executor`, `shadow-researcher`, `shadow-tester`, `shadow-auditor`.

**Enterprise Domain Pool (ERP-critical):** `shadow-erp-architect`, `shadow-accounting-domain`, `shadow-crm-sales-domain`, `shadow-hr-payroll-domain`, `shadow-inventory-warehouse`, `shadow-multitenancy-engineer`, `shadow-rbac-abac-engineer`, `shadow-audit-compliance`, `shadow-notification-engineer`, `shadow-workflow-bpm-engineer`, `shadow-form-builder-engineer`, `shadow-document-pdf-engineer`, `shadow-reporting-bi-engineer`, `shadow-search-engineer`, `shadow-realtime-collab`, `shadow-background-jobs-engineer`, `shadow-integration-middleware`, `shadow-import-export-migration`.

**Development Pool:** `shadow-fullstack-dev`, `shadow-backend-api`, `shadow-frontend-specialist`, `shadow-mobile-dev`.

**Design + UX:** `shadow-ui-designer`, `shadow-ux-researcher`, `shadow-graphic-designer`.

**Security:** `shadow-owasp-auditor`, `shadow-code-security-reviewer`, `shadow-pen-tester`, `shadow-bug-bounty-hunter`.

**Data + DevOps + AI:** `shadow-data-engineer`, `shadow-supabase-expert`, `shadow-data-scientist`, `shadow-ml-engineer`, `shadow-llm-engineer`, `shadow-prompt-engineer`, `shadow-perf-optimizer`, `shadow-ci-cd`, `shadow-deployment`, `shadow-monitoring`, `shadow-i18n-translator`, `shadow-seo-specialist`, `shadow-social-media`.

> هەر یەکێک checker ـی هاوبەشی هەیە (`shadow-<name>-checker.agent.md`) بۆ verification پاش implementation.
> سکیڵە هاوبەشەکان لە `.github/skills/shadow-shared/` (github-research, kurdish-rtl, owasp-top10, phase-gate).
> لیستی تەواو + routing لە [.github/agents/_index.md](.github/agents/_index.md) (D.1 - D.7).

ئاگاداربە: کاتێک بەکارهێنەر دەڵێت **"پلانساز"**، شادۆ پلانساز پێویستە **هەموو سکیڵ، رول، ئەیگێنت، و fact ـە verified ـەکانی repo** بزانێت — سەرەتا `.github/agents/_index.md`، `.github/skills/_index.md`، `.github/rules/_index.md` و `/memories/repo/` بخوێنێتەوە.

---

## 📚 سکیڵ‌ـە بنەڕەتیەکان

سکیڵەکان لە `.github/skills/<category>/<name>.md`:
- **backend/** — python-patterns, firestore-patterns, api-design-fastapi
- **frontend/** — typescript-strict, react19-patterns, antd-rtl-patterns
- **testing/** — tdd-workflow, test-coverage, e2e-playwright
- **security/** — security-review-owasp, agentshield-rules
- **meta/** — karpathy-guidelines, continuous-learning-v2, strategic-compact, verification-loop, search-first
- **harness/** — token-optimization, cost-aware-pipeline
- **docs/** — documentation-lookup
- **quality/** — plankton-code-quality, autonomous-loops
- **devops/** — deployment-windows

پلانساز پێویستە **هەموو سکیڵە بەردەستەکان** ببینێت پێش پلاندانان — لیستی تەواو لە [_index.md](.github/skills/_index.md).

---

## 🔁 Workflow پێشنیاری

| تاسک | کۆماند / ئەیگێنت |
|------|-------------------|
| پلانی فیچەری نوێ | پلانساز → دەڤەلۆپەر → تێستەر |
| Bug fix | تێستەر (reproduce) → دەڤەلۆپەر (fix) → تێستەر (verify) |
| Refactor | دەڤەلۆپەر + skill `refactor-clean` |
| Security check | شادۆ ئاژێنت‌شیلد + skill `agentshield-rules` |
| پەرفۆرمەنس | شادۆ ئەدا (web) + شادۆ هارنیس (LLM) |
| Doc update | شادۆ دۆکیومێنتەر |
| Continuous Learning | شادۆ کۆچ → `/memories/instincts/` |

---

## 🚫 NEVER

- ❌ ئەکس بکەیت `serviceAccountKey.json` لە git
- ❌ بەکار بهێنیت `&&` لە PowerShell
- ❌ skip لە `npm run build` (تەنها `tsc --noEmit` کێشە دەشارێتەوە)
- ❌ پشت ببەستیت بە Firestore composite indexes (هەموو filtering لە Python)
- ❌ ENGLISH-only error messages — کوردی پێویستە
- ❌ destructive Git command بێ ڕەزامەندی بەکارهێنەر
- ❌ `rtk` لەگەڵ interactive یان long-running command (uvicorn, vite, npm run dev, REPL)
- ❌ پشت ببەستیت بە RTK لە script ـدا بێ `Get-Command rtk` چێک

---

## 📝 وەرسیۆن

- RTK Integration v1.2 (Apr 2026) — Windows native hook + manual wrappers
- ECC Integration v1.1 (Apr 2026) — Foundation complete
- Document version: 1.2
- آخرین گۆڕانکاری: RTK 0.37.2 integrated
