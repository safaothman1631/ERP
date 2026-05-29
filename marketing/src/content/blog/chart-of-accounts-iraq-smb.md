---
title: "Chart of Accounts for an Iraqi SMB: The 5-Digit Structure"
description: "A pre-loaded 5-digit chart of accounts that fits Iraqi tax filings, sub-account discipline, and WHT/VAT reporting. Plus templates for retail, services, restaurants, and pharmacies."
date: 2026-05-19
author: "Akam Ahmed"
author_title: "Iraqi-licensed accountant"
tags: ["accounting", "coa", "chart-of-accounts", "smb"]
locale: en
reading_minutes: 8
target_query: "chart of accounts iraq smb"
og_image: /brand/og/blog-template-1200x630.png
---

The chart of accounts (CoA) is the spine of every accounting system. Get it right at setup and the next ten years of bookkeeping are a checklist. Get it wrong and every report you ever produce is fighting you. This article walks through the **5-digit Iraqi-SMB chart of accounts** we ship with the Kurdish ERP, why we chose 5 digits, how the major groupings work, and how to extend it for retail, services, restaurants, and pharmacies.

## Why 5 digits

Iraqi small-to-medium businesses sit in a sweet spot where:

- A 3-digit CoA (typical for a sole proprietor or freelancer) is too coarse — sub-account analysis becomes impossible.
- A 7-digit CoA (typical for a Big-4-audited group) is overkill — every journal entry becomes an exercise in code-look-up.

A 5-digit structure fits naturally:

- **First digit** — top-level category (1 = assets, 2 = liabilities, 3 = equity, 4 = revenue, 5 = expenses).
- **Second digit** — sub-category within the top level.
- **Last three digits** — specific account.

This matches the structure most Iraqi accountants are comfortable with and translates directly to the schedules required for annual tax filings.

## The top-level structure

```
1xxxx — Assets
  10xxx — Cash and equivalents
  11xxx — Receivables
  12xxx — Inventory
  13xxx — Prepaid expenses
  14xxx — Fixed assets
  15xxx — Accumulated depreciation
  16xxx — Intangible assets

2xxxx — Liabilities
  20xxx — Trade payables (AP)
  21xxx — Tax payables
  22xxx — Loans and credit
  23xxx — Accrued liabilities
  24xxx — Deferred revenue

3xxxx — Equity
  30xxx — Owner capital
  31xxx — Retained earnings
  32xxx — Current-year P&L

4xxxx — Revenue
  40xxx — Sales of goods
  41xxx — Services revenue
  42xxx — Other operating revenue
  43xxx — Non-operating revenue

5xxxx — Expenses
  50xxx — Cost of goods sold
  51xxx — Salaries and benefits
  52xxx — Rent and utilities
  53xxx — Marketing
  54xxx — Travel and entertainment
  55xxx — Professional fees
  56xxx — Office and supplies
  57xxx — Depreciation expense
  58xxx — Interest and finance
  59xxx — Other operating expenses
```

## The Iraq-specific accounts that matter

A few accounts in this chart are Iraq-specific and deserve attention:

### Tax payables (21xxx)

```
21100 — VAT payable
21110 — VAT collected on sales
21120 — VAT paid on purchases (input)
21200 — WHT payable to MoF
21210 — WHT payable — professional services (3%)
21220 — WHT payable — rent (5%)
21230 — WHT payable — contracts (2%)
21300 — Income tax payable
21400 — Customs / import duty payable
```

Splitting WHT by category is important because the MoF expects category-level remittance schedules. Lumping all WHT into one account makes the annual reconciliation painful.

### Inventory (12xxx)

```
12100 — Inventory — finished goods
12110 — Inventory — raw materials (manufacturing)
12120 — Inventory — work-in-progress (manufacturing)
12200 — Inventory — in transit
12300 — Inventory — at consignment
12900 — Inventory adjustments (shrinkage, expiry)
```

The adjustments account is where pharmacy expiry write-offs, retail shrinkage, and restaurant waste land. Track this carefully — it is one of the highest-signal accounts in a profitability analysis.

### Sales revenue (40xxx)

```
40100 — Sales — cash
40110 — Sales — card
40120 — Sales — credit (AR)
40200 — Sales — delivery
40210 — Sales — WhatsApp
40220 — Sales — platform (Talabat, etc.)
40900 — Sales returns and refunds (contra)
```

Splitting revenue by channel is the single highest-ROI accounting choice an Iraqi SMB can make. A restaurant owner who can see that delivery is 35% of revenue but only 18% of profit knows where to focus operations.

## Sector templates

The Kurdish ERP ships five CoA templates that extend the baseline above:

### Retail

Adds 12xxx sub-accounts for stock at each branch; 40xxx sub-accounts for sales by category; 53xxx for storefront signage; 56xxx for packaging.

### Services (consulting, IT, marketing)

Skips most 12xxx (no inventory); strengthens 41xxx (services revenue by engagement type); adds 55xxx sub-accounts for subcontractor fees (which need 3% WHT).

### Restaurants

Adds 50xxx sub-accounts for food cost, beverage cost, paper goods; 51xxx sub-accounts for kitchen vs front-of-house labor; 12xxx for raw food vs prepared food.

### Pharmacy

Adds 12xxx batch-tracked sub-accounts; 50xxx for COGS by therapeutic category; 41xxx for prescription vs OTC vs cosmetic revenue.

### Manufacturing

Adds 12xxx for raw / WIP / finished; 50xxx for direct material, direct labor, manufacturing overhead; 57xxx for factory-asset depreciation separately from office.

When you sign up for the Kurdish ERP, you pick a template at onboarding and the CoA is pre-populated.

## What goes wrong, and how to fix it

The three most common Iraqi-SMB CoA mistakes:

1. **One account called "Sales".** Lumps cash, card, delivery, online into one number. Useless for analysis. Fix: split by channel from day one.
2. **No separate WHT accounts.** The annual reconciliation becomes a manual mapping exercise. Fix: split WHT by category (3% / 5% / 2%).
3. **Inventory adjustments invisible.** Expiry, shrinkage, and waste are booked as random "miscellaneous expense" entries. The cost of these gets lost. Fix: use account 12900 (inventory adjustments) for everything that comes out of inventory without being sold.

Fixing a mature CoA is harder than setting it up correctly. If you are still in setup, take the hour to do it right.

## How to extend the CoA over time

The 5-digit structure has room for growth. When you need a new account:

- **Sub-account of an existing category.** Add the next 1xx code within the category. (E.g., to track a new revenue channel, add 40250 — Sales — partner X.)
- **New category within a top level.** Add a new ?xxxx code. (E.g., 17xxx for a new asset class.)

Avoid jumping between top levels. An expense account should always be 5xxxx, a revenue always 4xxxx, etc.

## Migrating from an existing CoA

If you are coming from a different software (Zoho, QuickBooks, Excel, paper), the migration steps:

1. **Export your existing trial balance** as of a clean cutoff date (typically year-end or quarter-end).
2. **Map each old account to the new 5-digit code.** Most maps are 1-to-1; a few may consolidate.
3. **Import opening balances** into the new CoA.
4. **Reconcile** the new trial balance against the old one — totals must match.
5. **Operate going forward** on the new chart.

The Kurdish ERP team has done this migration for dozens of Iraqi shops; the typical effort is half a day if you have clean source data.

## What this enables

A clean Iraqi-SMB CoA enables:

- Annual income-tax filing computed automatically.
- VAT and WHT registers exportable for the MoF.
- Per-channel profitability analysis.
- Inventory cost flow and shrinkage visibility.
- Audit-ready records the day an inspector calls.

This is the boring part of accounting and the part that pays compound dividends. See the [Kurdish ERP accounting features](/features) for the operational picture, and our [Iraq tax guide](/blog/iraq-tax-guide-2026) for how the CoA hooks into the tax filings.
