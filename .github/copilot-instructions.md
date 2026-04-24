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
- org_id: `cb160278-d674-46ed-912a-822b0023f7ae`

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

## 🤖 شادۆ ئەیگێنت‌ـە بەردەستەکان

### ERP-specific (٢٣ ئێستا)
ERP Brain, ERP CRM, ERP DevOps, ERP E-commerce, ERP HR, ERP Integration, ERP Inventory, ERP Localization Iraq, ERP Marketing, ERP Migration, ERP Odoo Researcher, ERP POS, ERP Project, ERP Sales, ERP Security, ERP UX, زۆهۆ ئەکاونتینگ، باکئێند، مێشک، داتابەیس، فرۆنتئێند، ریسێرچەر، تێستەر.

### Generic (١٣ بەردەست)
شادۆ مێشک، پلانساز، دەڤەلۆپەر، تێستەر، ئەدا، داتابەیس، DevOps، دیزاینەر، ناوەڕۆک، سۆشیال، شادۆ، graphic-designer، Explore.

### ECC-integrated (٩ چالاک)
شادۆ مێمۆری، کۆچ، ئاژێنت‌شیلد، هارنیس، ئیڤاڵ، ئۆرکێسترەیتەر، دۆکیومێنتەر، دۆکس‌لووکەر، سکیڵ‌میکەر.

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

---

## 📝 وەرسیۆن

- ECC Integration v1.1 (Apr 2026) — Foundation complete
- Document version: 1.1
- آخرین گۆڕانکاری: ECC Integration Sprints 1-7 complete
