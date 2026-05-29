---
title: "Iraqi Dinar Formatting Best Practices: Denominations, Rounding, and RTL Display"
description: "How to format IQD on invoices, receipts, dashboards, and exports. Denominations, integer-only rendering, RTL positioning, the د.ع suffix, and dual-currency display with USD."
date: 2026-04-08
author: "Kurdish ERP Team"
tags: ["iqd", "currency", "formatting", "design"]
locale: en
reading_minutes: 6
target_query: "iraqi dinar format invoice"
og_image: /brand/og/blog-template-1200x630.png
---

Iraqi Dinar is the only currency we ship as a primary in the Kurdish ERP, and over the last two years of building POS terminals, invoice templates, and dashboards we have settled on a handful of conventions that consistently produce a readable, professional result for Iraqi-market software. This article documents them in case you are building anything that displays IQD — your own software, your own invoice templates, or your own receipts.

## The fundamentals

**Iraqi Dinar has no functional fractional unit in 2026.** Fils (1/1000 of a dinar) exist as a legal concept and as a historical denomination, but no notes or coins below IQD 250 circulate. **Always render IQD as an integer.** Do not show "75,000.00 IQD" or "75,000.50 IQD" — those values are not meaningful to an Iraqi reader.

**Thousands separator.** In Arabic-Indic numeral contexts, the thousands separator is U+066C (Arabic Thousands Separator). In Western numeral contexts (and most contemporary Iraqi software), the comma works fine. Pick one and stick to it within a single UI surface.

**Currency suffix.** Use **د.ع** as the Arabic / Kurdish suffix and **IQD** in English contexts. Some software uses "ID" — it is not wrong but د.ع is more common and recognized.

**Positioning in RTL.** In a right-to-left text direction, the number reads from right (units) to left (highest denomination); the suffix follows the number. Browsers and most rendering libraries handle this correctly if the parent direction is set to `dir="rtl"`. Do not manually flip the digits — Western digits are read left-to-right even in an RTL paragraph; the BiDi algorithm handles the embedding.

The canonical patterns:

| Context | Render |
|---------|--------|
| Arabic / Kurdish, Western digits | `75,000 د.ع` |
| Arabic / Kurdish, Arabic-Indic digits | `٧٥٬٠٠٠ د.ع` |
| English | `IQD 75,000` |
| Compact (POS receipt) | `75,000` (currency implied by header) |

## Denominations — what circulates in 2026

The current denominations in circulation:

| Denomination | Color (approx) | Note size |
|-------------:|----------------|-----------|
| IQD 250 | Pink-purple | small |
| IQD 500 | Olive green | small |
| IQD 1,000 | Brown | small |
| IQD 5,000 | Red | medium |
| IQD 10,000 | Blue-green | medium |
| IQD 25,000 | Tan | medium |
| IQD 50,000 | Beige-purple | medium |

Higher denominations (IQD 100,000 onward) have been minted at various times but are not widely circulated in retail. For a cash drawer reconciliation interface, list exactly these seven rows. Use clear color cues for the cashier; do not require them to recognize text alone.

## Rounding

Because no fractional unit circulates, every transaction must end on an integer dinar. The rounding rules that work:

1. **Compute line-item totals in floating-point.** A 15% VAT on IQD 75,000 is IQD 11,250 exactly — no rounding needed. A 15% VAT on IQD 13,333 is IQD 1,999.95 — needs rounding.
2. **Round line VAT to the nearest integer** before summing.
3. **Compute the invoice total as the sum of integer-rounded line totals.** Do not round at the end of the invoice — that produces invoices where line-by-line addition does not match the displayed total.
4. **For payment**, round the final cash-due amount up or down to the nearest IQD 250 if you want to avoid sub-denomination change. Many Iraqi shops round to the nearest IQD 1,000 for cash payments and let the variance show in the books. This is a per-tenant policy in the Kurdish ERP.

## Dual-currency invoices

If you operate cross-border or quote in USD, your invoice may need to show both currencies. The pattern that works:

```
Subtotal:                     63,043 د.ع    (US$ 45.00)
VAT (15%):                     9,457 د.ع    (US$ 6.75)
─────────────────────────────────────────
Total:                        72,500 د.ع    (US$ 51.75)
```

The primary currency (IQD in Iraq) is dominant; the secondary currency is shown in parentheses, smaller, lighter color. The conversion rate used should be displayed once at the bottom of the invoice ("CBI rate as of 2026-05-29: 1 USD = 1,401 IQD") for the auditor's benefit.

The Kurdish ERP fetches the CBI rate daily at 09:00 Baghdad time and uses it for any new transaction that day; historical transactions retain the rate snapshot from their creation date so they remain reproducible at audit time.

## Arabic-Indic vs Western digits

Both digit families are correct Arabic. Modern Iraqi commerce has converged on Western digits (٠ → 0, ١ → 1, ٢ → 2, …) for most software UIs; older official documents and some governmental publications still use Arabic-Indic.

The Kurdish ERP exposes a tenant-level setting `digits: 'western' | 'arabic-indic'` that propagates to:

- Invoice and receipt PDF rendering.
- POS receipt printer output.
- In-app numeric displays.

The default is Western for ease of bilingual mixed-content rendering. For tenants who specifically need Arabic-Indic on official invoices, the toggle is one click.

## Dashboards and reports

For dashboard widgets showing aggregate IQD values, two more conventions:

- **Use compact units past 1M.** "1.2M د.ع" is more scannable than "1,200,000 د.ع" in a small widget. Use `Intl.NumberFormat` with `notation: 'compact'`.
- **Right-align numeric columns in tables**, regardless of language direction. Numbers compare visually only when the decimal points (or, here, the units place) line up.

## What not to do

- Do not use "ID" as the suffix in Arabic / Kurdish contexts. Use د.ع.
- Do not show ".00" or any decimals on integer IQD values.
- Do not center-align numeric table columns.
- Do not let the BiDi algorithm flip digits — do not insert RTL marks inside numbers.
- Do not show fewer than 3 significant digits on small values. "5,000" is good; "5K" is too small to round to in an invoice context.

## What this enables

Once IQD formatting is consistent across every surface — invoices, receipts, dashboards, exports — the rest of the system falls into place. The cashier reads the same value as the accountant reads as the auditor reads. Reconciliation becomes mechanical. Iraqi customers see software that respects their currency conventions rather than treating IQD as an afterthought USD-clone.

This is one of those Iraq-specific affordances we built into the Kurdish ERP from the first sprint, and it shows. See the [POS demo](/features) for a transaction running end-to-end in IQD with the conventions above. Or read our [POS setup walk-through](/blog/pos-setup-iraq-shopkeeper) for the hardware side.
