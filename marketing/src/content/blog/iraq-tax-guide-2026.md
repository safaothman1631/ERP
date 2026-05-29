---
title: "Iraq Tax Guide 2026: VAT, Withholding, and Corporate Tax for SMBs"
description: "A practical 2026 walk-through of the Iraqi taxes a small or mid-size business actually pays: VAT registration thresholds, withholding tax (3% / 5% / 2%), corporate vs flat-rate income tax, and the e-Fakhata rollout."
date: 2026-01-15
updated: 2026-05-20
author: "Akam Ahmed"
author_title: "Iraqi-licensed accountant, contributor"
tags: ["taxes", "vat", "withholding", "compliance"]
locale: en
reading_minutes: 9
target_query: "iraq vat tax guide smb"
og_image: /brand/og/blog-template-1200x630.png
featured: true
---

If you run a small or mid-size business in Iraq — a single shop in Erbil, a distribution outfit in Baghdad, a clinic in Sulaymaniyah — you will pay some combination of three taxes in 2026: **Value Added Tax (VAT)**, **Withholding Tax (WHT)**, and **Corporate or Flat-Rate Income Tax**. The rules are not complicated, but they are scattered across two authorities (the federal Ministry of Finance and, inside Kurdistan, the KRG Ministry of Finance), regularly amended, and rarely explained anywhere a non-accountant can read.

This guide is the explanation. It will not turn you into your own auditor, but it will tell you what to ask the auditor for, what to expect on a routine inspection, and what to wire into your accounting software so you stop hand-calculating the same numbers every month.

## 1. VAT — what it is, who pays it, when you register

Iraq has been moving toward a Value Added Tax (technically a hybrid sales/VAT regime) for several years. As of 2026:

- The VAT registration threshold sits at **IQD 100,000,000 in trailing twelve-month sales** for general taxpayers — though some sectors (telecom, hospitality, imports) carry mandatory registration regardless of turnover.
- The standard VAT rate is **15%** on most goods and services, with reduced rates on certain essentials and zero-rating on exports.
- VAT-registered businesses must issue **fiscal invoices** containing the seller TIN, buyer TIN (for B2B), invoice number, date, taxable amount per category, and the VAT amount as a separate line.
- VAT returns are filed monthly; the payment deadline is the **last business day of the following month**.

The most common SMB mistake is **registering too early**. If your annual revenue is under the threshold and you do not deal heavily in B2B, you may not benefit from VAT registration — you cannot reclaim input VAT on unregistered purchases anyway, and your administrative burden goes up. Confirm with an accountant whether voluntary registration makes sense for your supplier mix.

The second most common mistake is **misclassifying line items**. Restaurants, for example, often lump service charge into the food line — but service charge is taxable separately under different rules. Get your chart of accounts right at setup; correcting it after eighteen months of receipts is painful.

## 2. Withholding tax (WHT) — the 3% you might forget

WHT is the tax you deduct *from a supplier's payment* and remit to the MoF on the supplier's behalf. In Iraq it applies most commonly at three rates:

| Service category | Rate |
|------------------|-----:|
| Professional services (consulting, legal, accounting, IT) | **3%** |
| Rent (commercial property) | **5%** |
| Contracts (construction, large works) | **2%** |
| Royalties, dividends, interest | varies — typically 5–15% |

The mechanics are simple:

1. Your supplier invoices you IQD 1,000,000 for a consulting engagement.
2. You pay them IQD 970,000.
3. You owe the MoF the IQD 30,000 (3%) and remit it at the next filing.
4. You give your supplier a **WHT certificate** showing the deduction; they apply it against their own annual income tax.

In your books, this is one journal entry:

```
Dr Consulting expense          1,000,000
    Cr Cash / Bank                          970,000
    Cr WHT payable to MoF                    30,000
```

When you remit:

```
Dr WHT payable to MoF             30,000
    Cr Cash / Bank                           30,000
```

If you are using the [Kurdish ERP](/features) the WHT line is automatic — set the supplier's category once and every bill from them includes the withholding line.

The single biggest SMB compliance gap is **forgetting to withhold**. The MoF treats failure to withhold as if you personally owed the tax — and they will collect from you, not from the supplier.

## 3. Income tax — flat-rate SMB vs corporate

Iraqi income tax for businesses splits broadly into two paths:

- **Flat-rate SMB regime.** For businesses below certain revenue thresholds and outside specific industries (oil, banking, telecom), a simplified flat rate applies to taxable income — typically **5%** but verify the current year. Filing is annual, on a calendar-year basis, due 31 May.
- **Corporate income tax.** For companies above the threshold or in regulated sectors, the rate is **15%** on net taxable profit (35% in some specific sectors). Filing is annual but quarterly advance payments may be required.

The day-to-day implication: your accounting must distinguish **revenue** (top line), **deductible expenses** (operational, with documentation), and **non-deductible** outflows (owner draws, certain entertainment, capital purchases — which depreciate).

Your chart of accounts should be structured so that at year-end the **taxable income** computation is a single report, not a Saturday-afternoon spreadsheet drill. The Iraqi-style 5-digit chart we ship by default does exactly this — see [our chart of accounts guide](/blog/chart-of-accounts-iraq-smb).

## 4. e-Fakhata — what is changing in 2026

The Iraqi e-invoicing mandate, known locally as **e-Fakhata**, is rolling out in phases between 2024 and 2028. As of 2026:

- Large taxpayers (turnover above the threshold) are mandated.
- Mid-sized taxpayers are in the **voluntary onboarding** window.
- SMBs below the threshold remain on traditional fiscal-invoice formats but are encouraged to onboard.

An e-Fakhata invoice is an XML document signed with the issuer's MoF-provided private key, transmitted to the MoF endpoint, and assigned a unique reference and QR code. The PDF or printed receipt you give the customer includes the QR for verification.

If you are using the Kurdish ERP on the Pro plan, e-Fakhata generation, signing, and submission are end-to-end automatic. See our [e-Fakhata explainer](/blog/e-fakhata-explained) for the operational walk-through.

## 5. KRG vs federal — what differs in Kurdistan

Within the Kurdistan Region, certain taxes are administered by the **KRG Ministry of Finance** rather than the federal MoF. The practical differences:

- VAT and customs are federal — you deal with Baghdad.
- Income tax — KRG residents file with KRG MoF; the rates broadly track federal rates but procedures and deadlines may differ.
- WHT certificates issued in KRG are recognised federally, but for cross-region transactions verify the recipient's expected processing flow.

For most SMBs the practical advice is: **work with an accountant who knows your specific governorate**. The rules are stable, but the procedures shift each year.

## 6. The annual checklist

Whatever your size, the following are non-negotiable for a 2026 close:

1. **Reconcile all VAT collected vs VAT remitted** — totals should match within rounding.
2. **Reconcile the WHT register** — every certificate issued, every remittance documented.
3. **Income statement and balance sheet** for the calendar year.
4. **Annual income-tax filing** — flat-rate or corporate as applicable.
5. **e-Fakhata audit register** — exportable ZIP including all signed XMLs and PDFs for the year.
6. **Backup** — financial records must be retained for **at least 5 years** in a recoverable format.

The Kurdish ERP includes a "Tax auditor export" that produces this entire package in one click. If you are still maintaining the books in a notebook or in Excel, the cost of the migration is paid back the first time a tax inspector calls.

## What to do next

If you are not VAT-registered yet and are approaching the threshold, talk to an accountant about whether to register now or wait. If you are already collecting VAT, make sure your invoices include the legally-required fields. If you are paying suppliers for services, set up WHT calculations as a habit before the MoF flags you. And if you are running a business with more than ten staff or two locations, the Excel-based approach has reached its limit — see how the Kurdish ERP handles the [full accounting flow](/features) end-to-end.

The taxes are not the obstacle. The obstacle is the manual work of computing them. Automate that, and the rest is a checklist.
