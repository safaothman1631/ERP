# پلانی ئەرکەکانی خاوەن — ئەوەی لەسەر تۆ دەمێنێت (ERPIQ)

> **مەبەست:** ئەمە هاوبەشی `MASTER_IMPLEMENTATION_GUIDE_KU.md` ـە. ئەو دیکۆمێنتە هەموو **ڕێنماییە تەکنیکییەکانی** تێدایە (ئەوەی Claude دروستی کرد). ئەم دیکۆمێنتە هەموو **ئەرکەکانی تۆیە** — ئەوەی Claude ناتوانێ بیکات: یان پێویستی بە **Windows ـی تۆ** هەیە (تاقیکردنەوە + جێبەجێکردن)، یان **هەژمار/مرۆڤی** پێویستە (یاسا، سەرمایە، تیم، بڕواننامە، کڕیار).
>
> پێشینەبەندی: **P0** = پێش هیچ کڕیارێک · **P1** = پێش مەزنبوون · **P2** = قووڵکردن.

---

## ٠) دەستبەجێ — پشتڕاستکردنەوەی ئەوەی ئێستا کراوە (Windows)

> ئەم خولە Claude چەند گۆڕانکارییەکی سەلامەتی کرد (P0) بەڵام **هیچی commit/deploy نەکرد**. سەرەتا پشتڕاستیان بکەرەوە:

- [ ] **Backend تێست:** `cd backend && pip install -r requirements.txt && pytest` — دەبێت هەمووی سەوز بێت (+ ڕاپۆرتی coverage، گەیت ناشکێنێت چونکە `--cov-fail-under=0`).
- [ ] **Frontend گەیتەکان:** `cd frontend && npx tsc --noEmit && npm run build && npm run lint && npm run test`.
- [ ] **Marketing:** `cd marketing && npm run build` (بۆ نرخە ڕاستکراوەکان) → پاشان redeploy.
- [ ] **پێداچوونەوەی git:** `git status && git diff` — گۆڕانکاریی P0 ببینە (webhook HMAC، نرخ، پاکی ڕیپۆ، تێستی نوێ) → ئەگەر ڕازی بوویت `git commit`.
- [ ] **نهێنی webhook:** `IRAQ_PAYMENT_WEBHOOK_SECRET` لە production دابنێ + provider ڕێک بخە بۆ `X-Webhook-Signature`.
- [ ] **پاککردنەوە:** فۆڵدەری `docs/_sections/` بسڕەوە (تەنها سەرچاوەی دابەشکراوی ماستەر-ڕێبەرەکەیە؛ mount-ی sandbox نەیتوانی بیسڕێت).
- [ ] **کلیلی CI:** ئەگەر `gha-key.json` هەرگیز کلیلی ڕاستەقینەی تێدابووە لە مێژووی git → بیگۆڕە (rotate).

---

## ١) جێبەجێکردنی ڕێنماییەکان (هەرکام: برانچ → کۆد → `pytest` → merge)

> هەموو ئەمانە **ڕێنمایی ئامادەن** (کۆد + خاڵی دانان + تێست) لە دیکۆمێنتەکاندا. تۆ جێبەجێیان دەکەیت لەسەر Windows چونکە تاقیکردنەوەی backend لێرە نەکرا.

| # | ڕێنمایی | شوێن | پێشینە | پێشمەرج |
|---|---------|------|--------|---------|
| ١ | دروستیی دارایی: GL خۆکار + Decimal | `_deltas/P0-finance-correctness-IMPLEMENTATION.md` + ماستەر §٥ | **P0** | یەکەم بیکە (بناغەی دروستی) |
| ٢ | Scheduler-ی out-of-process + observability apply + DR runbook fix | ماستەر §٣ | **P0** | کارگێڕی — پێش کڕیار |
| ٣ | Event backbone (outbox+bus+saga) | `_deltas/P1-architecture-IMPLEMENTATION.md` | P1 | پێش کاری قووڵی مۆدیوول |
| ٤ | Perpetual valuation + COGS + costing-ی بەرهەمهێنان | `_deltas/P1-modules-IMPLEMENTATION.md` | P1 | پاش GL (#١) |
| ٥ | کۆچکردنی داتا/ETL (onboarding) | ماستەر §٤ | **P1** | پێویستە بۆ کڕیاری یەکەم |
| ٦ | MDM (golden record/governance) | `_deltas/P1-architecture-IMPLEMENTATION.md` | P1 | — |
| ٧ | WMS / TMS | `_deltas/P1-modules-IMPLEMENTATION.md` | P1/P2 | event (#٣) باشترە |
| ٨ | Workflow/BPMN engine + API gateway/OpenAPI | `_deltas/P1-architecture-IMPLEMENTATION.md` | P1/P2 | event (#٣) |
| ٩ | Consolidation / intercompany / fiscal | `_deltas/P1-modules-IMPLEMENTATION.md` | P2 | GL (#١) |
| ١٠ | شیکاری/EPM/BI + warehouse (BigQuery) | ماستەر §١ | P2 | — |
| ١١ | AI/ML + MLOps | ماستەر §٢ | P2 | warehouse (#١٠) |
| ١٢ | ستراتیژیی QA: بەرزکردنی coverage + contract/e2e/perf | ماستەر §٤ | P1 | بەردەوام |

> **بڕیاری کۆگای داتا** (ADR 0021): پێش #١٠ بڕیار بدە — Firestore بۆ OLTP بمێنێتەوە، BigQuery بۆ شیکاری، و هەڵسەنگاندنی Postgres بۆ GL.

---

## ٢) ئەرکە دەرەکی/مرۆڤییەکان (هیچیان کۆد نین — تەنها تۆ دەیکەیت)

### A) یاسایی و کۆمپانیا — **P0 (بەربەستی existential)**
- [ ] کۆمپانیا تۆمار بکە (LLC + CR-number + ناونیشانی فەرمی).
- [ ] counsel: بەڵگەنامە یاساییەکان واژۆ بکات (`legal/` ئێستا هەمووی DRAFT v0.1ـە: ToS/Privacy/DPA/MSA/SLA).
- [ ] بڕیاری data-residency بۆ PDPL (ئێستا backend لە europe-west1ـە).

### B) سەرمایە — **P0**
- [ ] pre-seed/seed کۆبکەرەوە (پیچ: `docs/business/fundraising-onepager.md`).

### C) تیم — **P0/P1**
- [ ] یەکەم ٨ ڕۆڵ دابمەزرێنە (پلان + JD: `docs/business/hiring-plan.md`). یەکەمین: CTO + ئەندازیار + QA + پشتگیری.
- [ ] چارەسەری bus-factor=١ (دۆکیومێنت + code review + خاوەنداریی دابەشکراو).

### D) e-Fakhata / سپێسی MoF — **P1**
- [ ] سپێس بەدەستبهێنە و پشتڕاست بکە (چێک‌لیست: `docs/compliance/e-fakhata-mof-verification-checklist.md`): XML/namespace/endpoint/cert + ڕێژەی باج.
- [ ] دوای پشتڕاستکردنەوە → جێبەجێکردنی چالاککردنی e-Fakhata (ماستەر §٥).

### E) بڕواننامەی پارەدان — **P1**
- [ ] بڕواننامەی merchant + sandbox بۆ FastPay / Qi / Zain Cash / Asia Pay.
- [ ] دوای credential → پڕکردنەوەی ٥ method-ی هەر گەیتوەیەک (skeleton لە ماستەر §٥).
- [ ] Stripe entity + keys (بۆ نێودەوڵەتی).

### F) بڕواننامەی ئاسایش — **P2**
- [ ] pen-test سەربەخۆ + bug-bounty + SOC 2 Type II + ISO 27001 + PDPL/GDPR (چێک‌لیست: `docs/compliance/soc2-iso27001-readiness-checklist.md`).

### G) کڕیار / پایلۆت — **P1**
- [ ] ٣–٥ پایلۆتی ڕاستەقینەی عێراقی واژۆ بکە و run بکە (runbook: `docs/business/pilot-onboarding-checklist.md`) → case study + NPS.

### H) هەژمار و infra — **P1**
- [ ] Sentry DSN، PagerDuty account، GCP WIF بۆ zoho-83cda (CI auto-deploy).
- [ ] BigQuery dataset (بۆ شیکاری)، دۆمەین یەکلایی‌کردنەوە (erpiq.systems vs zoho-kurdish.iq).

---

## ٣) board-ی ٩٠ ڕۆژ

پلانی ورد هەفتە-بە-هەفتە لە `docs/business/90-day-board.md` ـدایە (P0 + early-P1 + دامەزراندنی بزنس). پوختە:

- **هەفتە ١–٤:** پشتڕاستکردنەوەی P0 + commit · دەستپێکی کیانی یاسایی + counsel · پەیوەندی MoF + FastPay/Zain · جێبەجێکردنی GL/Decimal.
- **هەفتە ٤–٨:** scheduler/observability/DR fix · دامەزراندنی CTO+٢ ئەندازیار · ETL onboarding · seed.
- **هەفتە ٨–١٢:** event backbone دەستپێک · یەکەم design-partner/پایلۆت · بەرزکردنی coverage.

---

## ٤) ڕیزبەندیی پێشنیارکراو (کورتە)

1. **یەکەم (P0):** پشتڕاستکردنەوە+commit · کیانی یاسایی · سەرمایە · GL/Decimal · scheduler/observability/DR · یەکەم دامەزراندنەکان.
2. **دواتر (P1):** event backbone · ETL+onboarding · پایلۆت · MDM · valuation/costing · پارەدان+e-Fakhata (دوای credential/spec) · QA ramp.
3. **کۆتایی (P2):** WMS/TMS قووڵ · analytics/EPM · AI/MLOps · consolidation · بڕواننامەکان · microservices-ی selective.

---

> **کورتەی ڕاستگۆیانە:** ئەوەی لەسەر Claude بوو (ڕێنمایی + ADR + تێستی سەلامەت + بەڵگەی بزنس) **تەواوە**. ئەوەی ماوە، **جێبەجێکردنی ڕاستەقینەی کۆدە لەسەر Windows + ئەرکە مرۆڤی/دەرەکییەکان** — کە مانگانە کاری تیم و سەرمایەن، نەک کارێک کە لە یەک sandbox تەواو بکرێت. هەموو ڕێگاکە لە دیکۆمێنتەکاندا ڕوون کراوەتەوە.
