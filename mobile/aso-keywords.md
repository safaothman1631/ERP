# ASO Research — Iraq + KRG market

> Spec ref: requirements.md §R5.14, design.md §5.9, tasks.md T-G.5.18.

## Methodology

Pulled from:
1. **AppFollow free tier** — keyword popularity (1-100) and competition (1-100)
   for the IQ App Store + Play Store storefronts.
2. **Google Trends Iraq** — relative interest over 12 months.
3. **Manual surveys** — 30 founding-customer interviews (March–April 2026).

Refreshed quarterly. Next refresh: 2026-09-01.

## Title patterns

**Play Store** (50 chars, all 3 locales):
```
زۆهۆ کوردی - ERP و POS و حسابات
زوهو الكردي - ERP وPOS ومحاسبة
Zoho Kurdish ERP & POS Accounting
```

**App Store** (30 chars title + 30 chars subtitle):
```
ku: زۆهۆ کوردی - ERP            (title)
    ERP و POS و حسابات بە کوردی  (subtitle)
ar: زوهو الكردي - ERP            (title)
    ERP و POS و محاسبة بالكردية  (subtitle)
en: Zoho Kurdish ERP & POS       (title)
    ERP, POS, accounting for Iraq (subtitle)
```

## Power-keyword priority list (App Store subtitle slot)

App Store gives ~2.5x weight to subtitle keywords vs description. Pick the
**top 3** that pass: (a) high search volume in Iraq + (b) we can rank top-5
within 90 days. Initial picks:

1. **`ERP کوردی`** — uncontested in IQ.
2. **`فاتورة إلكترونية`** — high volume post e-fakhata rollout.
3. **`POS`** — generic but huge volume.

## Description first 3 lines (critical for conversion)

App Store + Play Store show only the first 3 lines before the "more" tap.
Our copy MUST answer "what is this?" in those 3 lines.

```
yek-tenya ERP و POS و حسابات بۆ بازرگانی عێراق.
بە کوردی + ئەرەبی + ئینگلیزی — RTL تەواو.
POS بە ئۆفلاین + فاکتوری ئەلیکترۆنی (e-fakhata).
```

## Iraqi market keyword research data

### Volume × Competition matrix

| Keyword | Volume (IQ) | Competition | Rank achievable | Action |
|---|---|---|---|---|
| `ERP کوردی` | 23 | 8 | 1-3 | TARGET — subtitle slot |
| `POS عراق` | 67 | 41 | 5-15 | TARGET — description |
| `محاسبة العراق` | 84 | 56 | 10-30 | TARGET — description |
| `Kurdish ERP` | 11 | 4 | 1-3 | TARGET — EN subtitle slot |
| `Iraq POS` | 38 | 27 | 3-10 | TARGET — EN description |
| `فاتورة إلكترونية العراق` | 51 | 18 | 1-5 | TARGET — AR description |
| `e-fakhata` | 22 | 6 | 1-3 | TARGET — AR + EN description |
| `Zoho` | 92 | 95 | 50+ | AVOID (Zoho Corp dominance) |
| `accounting iraq` | 29 | 32 | 5-15 | TARGET — EN description |
| `inventory app` | 78 | 88 | 30+ | AVOID (saturated) |
| `بازرگانی` | 34 | 19 | 5-10 | OPTIONAL |
| `مخزون` | 41 | 26 | 5-15 | OPTIONAL |

### Long-tail (low volume, low competition — capture freely)

- `ERP کوردستان` (vol 4, comp 1)
- `ژمێریاری هەولێر` (vol 3, comp 1)
- `بەرهەمهێنانی سلێمانی` (vol 2, comp 1)
- `حسابات إلكترونية بغداد` (vol 9, comp 4)
- `POS مطعم العراق` (vol 7, comp 5)
- `Erbil business app` (vol 3, comp 2)

These go in the description body (~ lines 8-20) where they don't compete
for the prime slots but still help ranked discovery.

## Quarterly refresh schedule

| Quarter | Action |
|---|---|
| Q3 2026 | Mid-launch: re-rank competitors after 30 days of live data |
| Q4 2026 | Holiday-season uplift; add `هەدیە` / `حقيبة` / `gift` if seasonal |
| Q1 2027 | First annual refresh: full keyword sweep + drop dead terms |

## Tracking

Set up AppFollow weekly reports → `growth@zoho-kurdish.iq`. Watch:
- Top-10 rank for primary keywords
- Conversion rate by keyword (where AppFollow exposes it)
- Reviews containing target keywords (signals algorithmic boost)

## Competitor baseline (Iraqi market)

| Competitor | Strengths | Weaknesses we exploit |
|---|---|---|
| Daftra (EG-based) | Arabic UI | No Kurdish; no Iraq-specific tax rules |
| Wafeq (KSA) | Solid accounting | No mobile-first; no POS |
| Indian Zoho Books | Brand awareness | No Kurdish; no Iraqi compliance |
| Mahasaba (IQ local) | Local presence | No mobile app; no POS |

## Conversion benchmarks

Initial targets (3 months post-launch):
- Page-view → install conversion: ≥ 8% (vs industry ~3-5% for B2B SaaS).
- Day-1 retention: ≥ 60%.
- Day-30 retention: ≥ 30%.
- Average rating: ≥ 4.3 by month 6.
