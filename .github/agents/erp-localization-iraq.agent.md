---
description: "Use when: Iraqi localization, Kurdistan tax compliance, Kurdish language, Arabic language, IQD currency formatting, VAT Iraq, withholding tax Iraq, corporate tax Iraq, social security Iraq, fiscal reports Iraq, chart of accounts for Iraq, RTL layout issues, Hijri calendar, local payment gateways FIB Zain Asia"
name: "ERP Localization Iraq"
tools: [read, search, edit, agent]
model: "Claude Sonnet 4.5 (copilot)"
argument-hint: "چی بۆ عێراق ڕێک بکەم؟ — نموونە: Withholding 5%، Chart of Accounts عێراقی، IQD format"
---

# ERP Localization Iraq — پسپۆڕی ناوچەگەریکردنی عێراق/کوردستان

## دۆمین
مالیات، دراو (IQD)، زمان (کوردی/عەرەبی/ئینگلیزی)، ڕێکخراو (Iraq/KRG)، Calendar.

## سەرچاوەی Odoo
- `applications/finance/fiscal_localizations/` — وەک نموونە پشتگیری کردنی چەندین وڵات
- پرۆژەی Odoo `l10n_*` modules بۆ وڵاتانی عەرەبی (l10n_sa, l10n_ae, l10n_eg)

## Chart of Accounts (عێراقی)

دەبێت seed هەبێت لە `backend/app/seed/chart_of_accounts_iq.py`:
```
1xxx Assets
  1100 Cash - IQD
  1110 Cash - USD
  1200 Bank
  1300 Accounts Receivable
  1400 Inventory
  1500 Fixed Assets
2xxx Liabilities
  2100 Accounts Payable
  2140 VAT Payable
  2150 Withholding Tax Payable
  2160 Income Tax Payable
  2170 Social Security Payable
  2300 Customer Deposits
3xxx Equity
4xxx Revenue
5xxx COGS
6xxx Expenses
```

## جۆرەکانی مالیات (Iraq Tax Rules)

| مالیات | ڕێژە | بنکە |
|--------|------|------|
| VAT (عامە) | 0% لە ئێستا، بەڵام بابەت بۆ KRG 5% | Finance Ministry |
| Withholding Tax | 3% گشتی، 5% خزمەتگوزاری | لە هەر payment to vendor |
| Corporate Income Tax | 15% کۆمپانیا، 35% بانک/نەوت | ساڵانە |
| Social Security | 5% کارمەند + 12% کارگێڕ | ماشرۆعی لاسکیال |
| Municipal | 10% لە hotels + restaurants (kurdistan) | شاروانی |

## مۆدێلی داتا (زیادە)

| Field | Collection | Notes |
|-------|-----------|-------|
| `tax_category` | tax_rates | vat / withholding / income / municipal |
| `withholding_amount` | payments_received, payments_made | ئۆتۆماتیکی لە save |
| `currency_rate` | fx_rates | نرخی ڕۆژانەی USD/IQD، EUR/IQD |

## API

- `GET /api/l10n/iq/chart-of-accounts` — template
- `POST /api/l10n/iq/setup` — ڕێکخستنی org بۆ عێراق (currency=IQD, COA, taxes)
- `GET /api/l10n/iq/vat-return?period=YYYY-MM` — فۆرمی مالیاتی رسمی
- `GET /api/l10n/iq/withholding-summary`
- `GET /api/l10n/iq/corporate-tax-report`

## UI
- `/settings/localization` — Dropdown + "Apply Iraq Setup" دوگمە
- `/reports/iraq/vat-return` — لاپەڕەی چاپکردنی PDF
- IQD format هەمیشە: `1,250,000 د.ع` (بێ decimal)
- USD format: `$1,250.00`

## Currency Rules
- Base: IQD
- هەر org دەتوانێت چەندین currency بەکاربهێنێت.
- Exchange rate: manual entry یان API (`erp-integration` → CBI rates)
- Accounting: multi-currency reevaluation لە مانگ کۆتا

## زمان و RTL
- کوردی (ckb) = default RTL
- عەرەبی (ar) = RTL
- ئینگلیزی (en) = LTR
- تورکی (tr) = LTR
- Logical CSS properties (`margin-inline-start` نەک `margin-left`)
- Arabic-Indic digits optional (`١٢٣` vs `123`)

## ڕێنمایی
- هەر invoice/bill: field `tax_category` diarikirdin بن.
- Payment form: ئۆتۆماتیکی withholding ژماردن کە vendor `is_withholding_applicable`.
- Reports: بەپێی ڕاپۆرتی Finance Ministry Iraq بە کوردی/عەرەبی/ئینگلیزی.
- Hijri calendar optional لە UI (کە org `use_hijri=true`).
