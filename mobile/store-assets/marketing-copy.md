# Marketing copy + ASO keywords

> Spec ref: requirements.md §R5.14, design.md §5.9, tasks.md T-G.5.18.

## Brand voice

- **Pragmatic** — Iraqi entrepreneurs are skeptical of buzzwords; lead with
  concrete features ("e-fakhata", "POS offline-first") not adjectives
  ("powerful", "innovative").
- **Tri-lingual** — every line tested in Kurdish, Arabic, English. Kurdish
  Sorani is the primary because it's a differentiator; Arabic broadens
  reach; English signals professionalism to investors.
- **Local pride** — references to "ئەو ١٨ پارێزگایە" (all 18 governorates)
  and Iraqi payment rails (FastPay, Qi, Zain) build trust faster than
  generic "multi-region" claims.

## Hero taglines (cycle on landing page)

| Lang | Hero (≤ 60 chars) |
|---|---|
| ku | یەکەم سیستەمی ERP کوردی ، بۆ بازرگانی عێراق |
| ar | أول نظام ERP كردي للأعمال العراقية |
| en | The first Kurdish-native ERP, built for Iraq |

## Sub-headlines (≤ 120 chars)

| Lang | Sub |
|---|---|
| ku | فاکتور و POS و ژمێریاری و CRM ، بە کوردی، ئەرەبی، ئینگلیزی — هەموو لە یەک شوێن |
| ar | فواتير، نقاط بيع، محاسبة، CRM — بالكردية والعربية والإنجليزية، الكل في مكان واحد |
| en | Invoices, POS, accounting, CRM — in Kurdish, Arabic, English, all in one place |

## Push-notification copy library

Used by the backend `push_notifications.send_to_*` helpers via `title_i18n`
/ `body_i18n`. Keep ≤ 30 chars title and ≤ 60 chars body — iOS truncates
on the lock-screen banner.

```yaml
invoice_paid:
  title:
    ku: فاکتورەکە پارەی هاتە
    ar: تم دفع الفاتورة
    en: Invoice paid
  body:
    ku: فاکتوری {n} ${amount} پارەی هاتە.
    ar: تم استلام {amount} للفاتورة {n}.
    en: Received {amount} for invoice {n}.

low_stock:
  title:
    ku: کۆگاکە کەم بووە
    ar: المخزون منخفض
    en: Low stock
  body:
    ku: "{item} تەنیا {qty} ماوەتەوە."
    ar: "{item}: متبقي {qty} فقط."
    en: "{item}: only {qty} left."

pos_shift_open:
  title:
    ku: شیفتی POS کرابووە
    ar: تم فتح وردية POS
    en: POS shift opened

# Marketing campaigns (silent push with category=marketing)
ramadan_promo:
  title:
    ku: تەنزیلاتی ڕەمەزان
    ar: عرض رمضان
    en: Ramadan offer
```

## ASO keyword brackets

Tracked weekly via AppFollow free tier; refresh quarterly per spec.

### Primary (high intent, paid placements OK)

| Keyword | Market | Why |
|---|---|---|
| `ERP کوردی` | KRG | No competition in Kurdish |
| `POS عراق` | IQ Arabic | Highest-volume POS query in Iraq |
| `محاسبة العراق` | IQ Arabic | Generic accounting search |
| `Kurdish ERP` | EN diaspora | Investor / press discoverability |
| `فاتورة إلكترونية العراق` | IQ Arabic | e-fakhata seekers post-2024 regulation |
| `Iraq POS` | EN | Tourist / expat / NGO operators |
| `e-fakhata` | IQ all langs | Direct intent post-MoF rollout |

### Secondary (long-tail; free to optimize for)

`ژمێریار`, `بازرگانی کوردی`, `مخازن العراق`, `كوب POS`, `Kurdistan accounting`,
`Erbil POS`, `Sulaymaniyah business`, `بەرهەمهێنانی عێراق`, `inventory iraq`.

### Negative (avoid — common in unrelated apps)

`zoho` standalone (confusion with Indian Zoho Corp — we are licensed but
distinct; never compete head-on for the name); `accounting free` (race-
to-the-bottom segment).

## Press-kit one-pager

Hosted at `https://zoho-kurdish.iq/press`. Contents:
- 200-word company blurb (ku/ar/en).
- Founder photo + bio.
- Product screenshots in all 3 langs.
- Logo lock-ups + brand colors.
- Press contact email.
