# پلانی دامەزراندنی تیم — ERPIQ Hiring Plan

> سەرچاوە: `ERP_World_Class_Plan_KU.docx` (بەشی E — بنیاتنانی بزنس) + دۆخی کۆدی ئێستا لە `CLAUDE.md`.
> **تێبینی:** هەموو ژمارەی مووچە/کات **خەمڵاندنی پلاندانانن (planning estimates)**، نەک ڕاوێژی دارایی یان یاسایی. پێش دامەزراندن لەگەڵ ڕاوێژکاری یاسایی/مووچە پشتڕاست بکەرەوە.

---

## 0. کورتە (TL;DR)

ERPIQ لە ئێستادا کۆدبەیسێکی فراوانی هەیە (frontend React 19 + backend FastAPI + Firestore، زیاتر لە ٣٠ مۆدیوول، POS، e-Fakhata، payments scaffold) بەڵام **بە یەک کەس** بنیاتنراوە. گواستنەوە بۆ کۆمپانیایەکی سەرمایە-پاڵپشت پێویستی بە تیمێکی فراوانبووی قۆناغ-بە-قۆناغ هەیە کە لەگەڵ پلانی world-class (قۆناغەکانی ٠–٤) دەگونجێت.

| قۆناغ | کاتی خەمڵێنراو | ژمارەی تیم (هەردووکی tech + ops) | ئامانجی سەرەکی |
|-------|----------------|----------------------------------|-----------------|
| **قۆناغی ٠** — بناغە/سەلامەتی | مانگ ٠–٣ | **٦–٨** | کیان، یەکەم هایەر، P0 (ئاسایش/دروستی دارایی)، design partner |
| **قۆناغی ١** — یەکەم داهات | مانگ ٣–٩ | **١٠–١٤** | e-Fakhata verified، payments کارا، ٥–١٥ کڕیاری پارەدەر |
| **قۆناغی ٢** — قووڵایی + مەزنبوون | مانگ ٩–١٨ | **١٨–٣٠** | هەر ١٠ مۆدیوول production، observability، DR، SOC 2 prep |
| **قۆناغی ٣** — فراوانبوون | مانگ ١٨–٣٠ | **٣٠–٥٠+** | ١٠٠+ کڕیار، SOC 2 / ISO، AI، فرە-کۆمپانیا |
| **قۆناغی ٤** — world-class | مانگ ٣٠–٤٨ | **٥٠+** | بڕواننامەی تەواو، پانتایی بازاڕ، K8s |

> یەکەم داهات لە مانگی ٦–٩ چاوەڕوان دەکرێت (بەپێی پلانەکە). بۆیە قۆناغی ٠ و ١ دەبێت بە سەرمایەی سەرەتایی (pre-seed/seed) تەواو بکرێن.

---

## 1. ڕیزبەندی هایەر (Role Priority Order)

پێشینەبەندی لەسەر بنەمای **مەترسی** و **بلۆکەری داهات** ڕێکخراوە — یەکەم ئەو ڕۆڵانە دێن کە کۆد/کڕیار/ئاسایش بلۆک دەکەن.

| # | ڕۆڵ | قۆناغی هایەر | هۆکار (چرا ئێستا؟) |
|---|------|---------------|----------------------|
| 1 | **CTO / Engineering Lead** | قۆناغی ٠ | کۆدبەیس بە یەک کەس بنیاتنراوە؛ پێویستی بە خاوەنی تەکنیکی + بڕیاری ئەرکیتێکچەر (Firestore→ledger؟ K8s؟) هەیە |
| 2 | **Senior Backend Engineer** | قۆناغی ٠ | دروستی دارایی (GL/Decimal)، payment adapters، e-Fakhata — مەترسیدارترین بەش |
| 3 | **Senior Frontend Engineer** | قۆناغی ٠–١ | ٢٩٥ پەڕە + design system؛ پاراستن + کوالیتی + RTL/i18n |
| 4 | **QA / SDET** | قۆناغی ١ | ١٣٢١ تێست هەیە بەڵام coverage کەمە؛ گەیتی CI + تێستی پارە = مەرجی launch |
| 5 | **DevOps / SRE** | قۆناغی ١ | Cloud Run + Vercel ئێستا؛ بۆ مەزنبوون پێویستی بە IaC، observability، DR، on-call |
| 6 | **Product / Implementation Manager** | قۆناغی ١ | کۆتاکردنەوەی design partner → کڕیار؛ خاوەنی ڕۆڵی onboarding + پێشینەبەندی |
| 7 | **Support / Customer Success Lead** | قۆناغی ١ | بەشی عێراق پشتیوانی کوردی/عەرەبی + WhatsApp دەخوازێت؛ activation + retention |
| 8 | **Accountant / Compliance Officer** | قۆناغی ٠–١ | پشتڕاستکردنی نرخی باج (R7.1) + e-Fakhata MoF spec + کیانی یاسایی؛ بەبێ ئەمە، compliance fake دەمێنێتەوە |

> دوای ئەم ٨ ڕۆڵە: data engineer (BigQuery/warehouse)، mobile engineer، designer (full-time)، sales، security engineer، AI/ML engineer لە قۆناغی ٢–٣ دێن.

---

## 2. وەسفی کاری ٨ ڕۆڵە سەرەکییەکە (Short JDs)

### 2.1 — CTO / Engineering Lead  *(قۆناغی ٠، یەکەم هایەر)*
- خاوەنی ئەرکیتێکچەری گشتی + بڕیارە چارەنووسسازەکان (Firestore vs Postgres بۆ GL، K8s، event bus).
- بنیاتنانی پرۆسەی ئەندازیاری: code review، CI gates، release process، on-call.
- دامەزراندن و ڕابەرایەتی تیمی ئەندازیاری (مووچە + interview).
- پارێزراوی ئاسایش + پابەندبوون (SOC 2 / ISO roadmap لەگەڵ compliance).
- پێداویستی: ١٠+ ساڵ ئەزموون، scale-up SaaS، فایننس/ERP باشترە، توانای کوردی/عەرەبی/ئینگلیزی بۆ تیمی ناوخۆیی.

### 2.2 — Senior Backend Engineer  *(قۆناغی ٠)*
- خاوەنی لایەری دارایی: GL خۆکار، Decimal-everywhere، WHT/VAT، reconciliation.
- تەواوکردنی payment adapters (FastPay/Qi/Zain/Asia Pay) کاتێک credentials دەگەن.
- e-Fakhata: XML schema، XAdES-BES signing، MoF submission queue.
- API contract (OpenAPI) + idempotency + RBAC enforcement.
- پێداویستی: Python/FastAPI، Firestore یان Postgres، ئەزموونی فایننس/payments، تێست-محور.

### 2.3 — Senior Frontend Engineer  *(قۆناغی ٠–١)*
- پاراستن + فراوانکردنی design system (Vertex)، React 19 + AntD v6 + Zustand.
- RTL + i18n (کوردی/عەرەبی/ئینگلیزی)، a11y، performance budget.
- POS offline-first (IndexedDB)، hardware integration (ESC/POS).
- پێداویستی: React/TypeScript senior، RTL/i18n ئەزموون، PWA/offline، توانای کوردی بۆ کوالیتی UI.

### 2.4 — QA / SDET  *(قۆناغی ١)*
- بەرزکردنەوەی coverage (بەتایبەت لایەری پارە/باج)، گەیتی CI.
- تێستی e2e (Playwright)، تێستی یەکگرتن، تێستی پارەدان sandbox.
- پلانی تاقیکردنەوەی Iraqi edge-cases (offline POS، کاتی پچڕانی کارەبا، IQD).
- پێداویستی: SDET، Python + JS/TS، CI/CD، ئەزموونی فایننس/regulated باشترە.

### 2.5 — DevOps / SRE  *(قۆناغی ١)*
- IaC تەواو (Terraform)، گواستن لە Cloud Run بۆ GKE (قۆناغی ٢+).
- observability (OpenTelemetry، Grafana/Sentry)، alerting، on-call rotation.
- DR (backup/restore drills)، secrets (Vault/Secret Manager)، CI auto-deploy.
- پێداویستی: GCP، Kubernetes، Terraform، monitoring stack، SRE practices.

### 2.6 — Product / Implementation Manager  *(قۆناغی ١)*
- خاوەنی roadmap + پێشینەبەندی؛ پردی نێوان کڕیار و ئەندازیاری.
- ڕابەرایەتی design partner + pilot → کڕیاری پارەدەر.
- خاوەنی onboarding runbook + activation metrics.
- پێداویستی: product/implementation لە B2B SaaS، زانیاری بازاڕی عێراق، کوردی/عەرەبی.

### 2.7 — Support / Customer Success Lead  *(قۆناغی ١)*
- دامەزراندنی پشتیوانی کوردی/عەرەبی (WhatsApp + helpdesk + KB).
- خاوەنی NPS/CSAT، retention، escalation بۆ ئەندازیاری.
- بنیاتنانی training material (سکریپتی ku/ar).
- پێداویستی: customer success/support، زمانی کوردی+عەرەبی، ئەزموونی SaaS/SMB.

### 2.8 — Accountant / Compliance Officer  *(قۆناغی ٠–١)*
- پشتڕاستکردنی نرخەکانی باج (R7.1 — هەموو ئێستا placeholder: WHT 3٪/5٪/2٪، VAT 0٪، hospitality 10٪، telecom 20٪).
- پشتڕاستکردنی e-Fakhata MoF spec (XML schema، namespace، endpoints، cert) — برای checklist بڕوانە `docs/compliance/e-fakhata-mof-verification-checklist.md`.
- ڕابەرایەتی کیانی یاسایی (LLC) + پارێزراوی دارایی ناوخۆیی.
- پێداویستی: ژمێریاری مۆڵەتدار لە عێراق/هەرێم، زانیاری باجی عێراق + e-Fakhata، عەرەبی + کوردی.

---

## 3. تێبینی بازاڕی هێزی کار لە عێراق (Iraq Talent Notes)

- **شوێن:** هاوبەشی hub لە **هەولێر** (Erbil) — ئاسایش، ئینفراستەرکچەری باشتر، نزیک لە تیمی KRG. **بەغدا** بۆ گەیشتن بە بازاڕی فیدراڵی + هاوکاری MoF/پارەدان. **ریمۆت** بۆ ڕۆڵە سینیۆرەکان (CTO/SRE) کە لەوانەیە لە دەرەوەی عێراق یان دایاسپۆرا بن.
- **مۆدێلی تێکەڵ:** ناوک (junior/mid engineers، support، QA) لە هەولێر؛ سینیۆر/تایبەتمەند بە ریمۆت (دایاسپۆرای کورد/عێراقی لە ئەوروپا/ئەمریکا زۆرن و ئاگاداری بازاڕن).
- **زمان:** کوالیتی UI/support پێویستی بە کوردی سۆرانی + عەرەبیی ڕەسەن هەیە — ئەمە بەشێکی مۆڵە (moat)، بۆیە لانیکەم ٢–٣ کەسی native-speaker لە تیمی product/support پێویستن.
- **چاودێری مووچە:** بازاڕی هەولێر/بەغدا مووچەی نزمترە لە ئەوروپا، بەڵام تالێنتی senior backend/SRE کەمە؛ ریمۆت + equity بۆ کێشانیان. (ژمارەی دیاریکراو = خەمڵاندن، پێش offer benchmark بکە.)
- **پابەندبوونی یاسایی کار:** قانوونی کاری عێراق/هەرێم بۆ گرێبەست، بیمە، و مووچە — لەگەڵ ڕاوێژکاری یاسایی پشتڕاست بکەرەوە (نزیکە لە بەشی کیانی یاسایی).
- **یەکەم هایەر:** CTO + ١ senior backend دەبێت یەکەم بن (پێش هەر کەسی تر)، چونکە بەبێیان P0 (ئاسایش + دروستی دارایی) ناکرێت و مەزنبوونی تیم بێ ڕابەری تەکنیکی مەترسیدارە.

---

## 4. خشتەی کورتی هایەر بەپێی قۆناغ (Headcount Build)

| ڕۆڵ | ق٠ (٦–٨) | ق١ (١٠–١٤) | ق٢ (١٨–٣٠) | ق٣ (٣٠–٥٠+) |
|------|:--:|:--:|:--:|:--:|
| CTO / Eng Lead | 1 | 1 | 1 | 1 |
| Backend Eng | 1 | 2–3 | 4–6 | 8–12 |
| Frontend Eng | 1 | 2 | 3–4 | 5–7 |
| QA / SDET | — | 1 | 2 | 3–4 |
| DevOps / SRE | — | 1 | 2 | 3 |
| Product / Impl | 1 | 1–2 | 2–3 | 3–4 |
| Support / CS | 1 | 1–2 | 3–4 | 6–10 |
| Accountant / Compliance | 1 (part) | 1 | 1–2 | 2–3 |
| Data / AI / Mobile / Security / Sales | — | شەپۆلی داهاتوو | 3–6 | 8–12 |
| **کۆ (≈)** | **6–8** | **10–14** | **18–30** | **30–50+** |

> ژمارەکان لەگەڵ پلانی world-class (قۆناغەکانی ٠–٤) دەگونجێن و **خەمڵاندنن**؛ بەپێی داهات + سەرمایە دەگۆڕێن.
