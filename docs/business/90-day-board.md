# بۆردی جێبەجێکردنی ٩٠ ڕۆژ — ERPIQ (Weeks 1–12)

> بۆردێکی کرداری بۆ یەکەم ٩٠ ڕۆژی گواستنەوە لە «demo» بۆ «کۆمپانیای سەرمایە-پاڵپشت». مەپ دەکات: **P0** (ئاسایش + دروستی دارایی) + سەرەتای **P1** + **بنیاتنانی بزنس** (کیان، سەرمایە، یەکەم هایەر، design partner).
> خاوەنەکان بە **ڕۆڵ** نووسراون (placeholder تا هایەر بکرێن). هەموو کات/ژمارە خەمڵاندنن.

**ڕۆڵە کورتکراوەکان:** F = Founder · CTO = Eng Lead · BE = Senior Backend · FE = Senior Frontend · QA = QA/SDET · OPS = DevOps/SRE · PM = Product/Impl · CS = Support/CS · ACC = Accountant/Compliance · LEGAL = ڕاوێژکاری یاسایی (دەرەکی)

---

## مانگی ١ — بناغە + سەلامەتی (Weeks 1–4)

| هەفتە | کار | خاوەن | مەرجی تەواوبوون (Exit Criteria) |
|:--:|------|:--:|---------------------------------|
| 1 | دەستپێکی کیانی یاسایی (LLC) — هەڵبژاردنی jurisdiction + ڕاوێژکار | F + LEGAL | ڕاوێژکار دیاریکراو، پرۆسە دەستی پێکرد |
| 1 | پلانی سەرمایە finalize (one-pager + deck) | F | deck ئامادە بۆ گفتوگۆ |
| 1 | **P0 ئاسایش**: دانانی `IRAQ_PAYMENT_WEBHOOK_SECRET` + verify HMAC لە webhooks | F/BE | webhook بێ-واژۆ → 401/503؛ تێست سەوز |
| 1–2 | پاکی repo: لابردنی secrets/keys لە git tracking | F/OPS | `gha-key.json` + test files untracked، `.gitignore` نوێ |
| 2 | یەکەم هایەر: گەڕان بۆ CTO + Senior Backend (job posts) | F | ٢ post بڵاوکرایەوە، یەکەم interviews |
| 2 | **P0 دارایی**: پلانی GL خۆکار + Decimal-everywhere review | F/BE | پلان + تێست drafted (پێش گۆڕینی کۆد) |
| 2–3 | هەڵبژاردنی ١–٣ design partner (هەولێر/بەغدا) | F/PM | لیستی hot prospects + یەکەم کۆبوونەوە |
| 3 | یەکخستنی نرخ لە marketing + plans (consistency) | F | grep پاک، نرخ یەکسان |
| 3 | پشکنینی تەواوی gates (tsc/lint/build/test) لەسەر Windows | F/QA | هەموو سەوز، baseline تۆمارکراو |
| 4 | بانگکردنی ACC (part-time) بۆ R7.1 + e-Fakhata verification | F/ACC | ACC دامەزرا/گرێبەست، checklist دەستی پێکرد |
| 4 | گرێبەستی design partner واژۆ | F/PM/LEGAL | لانیکەم ١ partner واژۆ کرا |

---

## مانگی ٢ — یەکەم هایەر + Design Partner چالاک (Weeks 5–8)

| هەفتە | کار | خاوەن | مەرجی تەواوبوون |
|:--:|------|:--:|------------------|
| 5 | offer + onboard بۆ CTO | F/CTO | CTO دەستی بەکار کرد |
| 5 | **e-Fakhata MoF verification**: پەیوەندی فەرمی + وەرگرتنی spec | ACC/CTO | یەکەم وەڵام لە MoF (بڕوانە compliance checklist) |
| 5–6 | onboard بۆ Senior Backend | CTO/BE | BE دەستی بەکار کرد، codebase walkthrough |
| 6 | **P0 دارایی**: جێبەجێکردنی GL خۆکار + تێست (بە BE) | BE/CTO | فاکتور/پارە → journal entry خۆکار + تێست سەوز |
| 6 | دامەزراندنی design partner #1 (pre-pilot setup + migration) | PM/CS | tenant + data migration تەواو |
| 7 | پشتڕاستکردنی نرخی باج (R7.1) — یەکەم بەشی نرخەکان | ACC | placeholder rates → verified بۆ ١–٢ کەرت |
| 7 | training-ی design partner #1 | CS/PM | ٣ session تەواو، champion دیاریکراو |
| 7–8 | پەیوەندی بۆ payment credentials (FastPay/Qi/Zain) | F/BE | sandbox credentials داواکرا/وەرگیراوە |
| 8 | یەکەم گفتوگۆی سەرمایە (pre-seed/seed) | F | ٣–٥ کۆبوونەوەی سەرمایەدار |
| 8 | **offline POS test** لەگەڵ design partner (کارەبا) | PM/CS/FE | POS لە کاتی پچڕان کار دەکات، sync دروست |

---

## مانگی ٣ — یەکەم داهات + هایەری زیاتر (Weeks 9–12)

| هەفتە | کار | خاوەن | مەرجی تەواوبوون |
|:--:|------|:--:|------------------|
| 9 | offer + onboard بۆ Senior Frontend + QA | CTO/FE/QA | FE + QA دەستی بەکار |
| 9 | **e-Fakhata**: جێبەجێکردنی verified schema (دوای MoF) | BE/ACC | XML/namespace/cert نوێکرایەوە بەپێی spec |
| 9–10 | payment adapter یەکەم (sandbox) کاتێک credentials گەیشتن | BE | لانیکەم ١ provider sandbox کار دەکات |
| 10 | coverage + گەیتی CI (تێستی پارە) | QA/BE | coverage gate دانراوە، تێستی پارە سەوز |
| 10 | 30-day review-ی design partner #1 (NPS/CSAT) | PM/CS | NPS وەرگیرا، فیدباک تۆمارکرا |
| 11 | onboard بۆ DevOps/SRE (سەرەتای observability) | CTO/OPS | OPS دەستی بەکار، monitoring plan |
| 11 | داڕشتنی gates بۆ launch (e-Fakhata + payments + offline) | CTO/QA | checklist-ی launch ئامادە |
| 12 | یەکەم کڕیاری پارەدەر (exit-to-paid بۆ partner #1 ئەگەر مەرج بوو) | F/PM/CS | ١+ کڕیاری پارەدەر یان commitment ڕوون |
| 12 | کۆتایی سەرمایە (term sheet ئەگەر مەرج بوو) | F/LEGAL | term sheet یان pipeline ڕوون |
| 12 | review-ی ٩٠ ڕۆژ + پلانی مانگی ٤–٦ | F/CTO/PM | retro + roadmap-ی قۆناغی ١ نوێکرایەوە |

---

## ئامانجە سەرەکییەکانی ٩٠ ڕۆژ (Key Milestones)

| # | Milestone | کات |
|---|-----------|------|
| 1 | کیانی یاسایی (LLC) دەستی پێکرد/تەواوبوون | مانگ ١–٣ |
| 2 | یەکەم ٤ هایەر (CTO، BE، FE، QA) | مانگ ١–٣ |
| 3 | P0 تەواو (webhook security + GL/Decimal + repo cleanup) | مانگ ١–٢ |
| 4 | e-Fakhata MoF verification دەستی پێکرد/تەواوبوون | مانگ ٢–٣ |
| 5 | ١+ design partner چالاک + offline POS test سەرکەوتوو | مانگ ٢–٣ |
| 6 | یەکەم کڕیاری پارەدەر یان commitment | مانگ ٣ |
| 7 | سەرمایەی pre-seed/seed (pipeline یان closed) | مانگ ٣ |

> **مەترسە/Risks:** payment credentials + MoF spec هەردووکیان **دەرەکین** (دەستی ERPIQ نییە) — ئەگەر درەنگ بن، launch دواکەوت. بۆیە لە هەفتەی ٥ و ٧ زوو دەستیان پێبکرێت. هایەری senior لە بازاڕی عێراق کاتبەرە — هەفتەی ٢ دەست بکە.
