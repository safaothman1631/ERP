---
title: "Pharmacy Management in Iraq: Expiry, Batch Tracking, and Insurance Billing"
description: "Running a pharmacy in Iraq means tracking drug expiry per batch, multi-supplier inventory, regulator-required reporting, and increasingly insurance billing. Here is how to operationalize it."
date: 2026-03-02
author: "Dr. Shilan Karim"
author_title: "Pharmacist and contributor"
tags: ["pharmacy", "inventory", "healthcare", "expiry"]
locale: en
reading_minutes: 8
target_query: "pharmacy management iraq"
og_image: /brand/og/blog-template-1200x630.png
---

A pharmacy is one of the hardest retail operations in Iraq to run well. You hold thousands of SKUs from dozens of suppliers, every item has an expiry date that matters legally and clinically, regulators expect you to produce a current inventory on demand, and increasingly Iraqi insurers want their own line-item invoicing for reimbursement claims. This article walks through how a small or mid-size Iraqi pharmacy operationalizes inventory, expiry, supplier reconciliation, and insurance billing — and what to wire into the accounting and POS layer to make the work manageable.

## The four problems a pharmacy must solve

1. **Drug expiry per batch.** A 30-tablet box of paracetamol is not just an SKU — it is a specific batch with a specific expiry date. Two boxes from the same supplier on different shipments may have different expiries. You cannot manage this on a spreadsheet past about 200 SKUs.
2. **Multi-supplier inventory.** A typical Iraqi pharmacy buys from 15 – 40 wholesalers, sometimes weekly, sometimes only when stock runs low. Reconciling stock-in across suppliers and matching against payment terms is its own discipline.
3. **Regulator-required reporting.** The Iraqi Ministry of Health expects pharmacies to be able to demonstrate, on inspection, current inventory of controlled substances and a recent stock count. The KRG MoH applies similar rules in Kurdistan.
4. **Insurance billing.** As private insurance penetrates the Iraqi market in 2026, more pharmacies are billing insurers directly for prescriptions. Each claim is a per-line invoice with item-level NDC/equivalent codes, patient ID, prescription number, and a co-pay split.

## Batch tracking — the non-negotiable

Every SKU in a pharmacy should be **batch-tracked**, not just count-tracked. The difference:

| Approach | Implication |
|----------|-------------|
| Count-tracked | "We have 50 paracetamol 500mg in stock." (You do not know which 50.) |
| Batch-tracked | "We have 30 paracetamol 500mg from batch ABC123 expiring 2027-04; and 20 from batch DEF456 expiring 2026-09." (You know which to dispense first.) |

The dispensing rule is **FEFO**: first-expired, first-out. When a cashier rings up paracetamol, the POS picks the batch with the earliest expiry and decrements that one. The system also flags items whose nearest expiry is under 90 days for the pharmacist's review — these become candidates for return-to-supplier or discount sale.

In the Kurdish ERP's pharmacy module (under `/ext/pharmacy`), each SKU has:

- Brand name
- Generic name
- Strength + form (e.g., "500mg tablet")
- ATC code (optional, for clinical reporting)
- Schedule (over-the-counter, prescription, controlled)
- Default supplier
- Reorder point

And each batch has:

- Batch number
- Quantity on hand
- Expiry date
- Cost of acquisition
- Supplier of this batch

The cashier never sees batch detail at the till — the system picks; the pharmacist sees everything at the back office.

## Expiry alerts

A pharmacy should be running **three rolling reports** every Monday morning:

1. **90-day expiry.** Everything expiring in the next 90 days. Action: contact supplier about return policy, mark for discount, or write off.
2. **30-day expiry.** Everything expiring in the next 30 days. Action: pull from shelf, write off if no return path.
3. **Expired.** Everything that has crossed expiry but is still in inventory records. Action: physical disposal and inventory adjustment (an expense booked against `5210 — Inventory shrinkage`).

The Kurdish ERP runs these reports automatically and pushes a weekly summary to the pharmacist's WhatsApp on the Growth and Pro plans.

## Multi-supplier reconciliation

Most Iraqi pharmacies pay suppliers on terms — typically Net 30 or Net 60, sometimes informally extending into Net 90 with the relationship-based suppliers. The reconciliation discipline is:

1. **Every stock-in is a bill.** A supplier delivery becomes a Bill record in the accounting system, with the invoice number, the date, the line items, and the payment terms.
2. **Stock physically arrives → bill is approved → inventory increases.** Not before. (If you receive stock without paperwork, mark the bill "pending" and chase the paperwork; do not just add it to inventory.)
3. **Payment cycle: weekly.** Each Wednesday (or whichever day works for your supplier mix), review the bills due in the next 7 days, pay via the bank channel or by hand-delivered cash where the supplier requires it, mark paid.

This discipline lets you (a) hit your supplier discounts, (b) avoid over-paying because of double-invoicing errors, and (c) produce an aged-payables report on demand for a regulator or auditor.

## Insurance billing

Iraqi private insurance is fragmented but growing. Each insurer has its own claim format, its own approved-drug list (formulary), and its own co-pay rules. The operational pattern that works:

1. **Patient identification at the till.** When a prescription is dispensed for an insured patient, the cashier captures the patient ID and insurer.
2. **Per-line invoice generated** with: insurer code, patient ID, prescription number, item-level code, dispensed quantity, co-pay split, insurer-paid portion.
3. **Daily claim batch** to each insurer at end of day. Some insurers accept email PDFs; the larger ones increasingly use a portal or API.
4. **Reconciliation** when the insurer pays — typically Net 30 to Net 60. Aged receivables from insurers are tracked separately because the chase pattern is different from B2B.

The Kurdish ERP supports this pattern via the `insurance_claim` document type in the pharmacy module. The Pro plan includes batch-claim export for the three largest Iraqi insurers (specific names depend on which are operating in 2026).

## Inventory regulators expect

When the MoH or KRG MoH inspector arrives, they will ask for:

- **Current stock list** by SKU and quantity.
- **Controlled-substance log** — every receipt and dispense of any controlled item, with patient and prescriber where applicable.
- **Stocktake records** for the last 12 months. Most regulators expect at least a quarterly physical stocktake.
- **Disposal records** for any item written off as expired or damaged.

All four of these are exportable from the Kurdish ERP pharmacy module as PDF or Excel on demand. If you are currently maintaining these on paper, the time burden is the single biggest reason to migrate.

## The closing checklist for a pharmacy

If you are setting up or modernizing pharmacy management:

1. **Move to batch tracking.** This is the non-negotiable. Spreadsheets do not scale past a few hundred SKUs.
2. **Set 90/30 expiry alerts** as a habit.
3. **Bill every supplier delivery.** Approve before stock-in.
4. **Run the regulator reports monthly** so you are never surprised by an inspection.
5. **Stand up insurance billing** if you are not already — the volume is going to keep growing through 2026 and beyond.

The Kurdish ERP's pharmacy module ships with all of the above on the Growth and Pro plans. See the [pharmacy module](/features) for the full operational picture. And if you would like help migrating from a paper-based or Excel-based pharmacy system, our team has done this for a dozen Iraqi pharmacies in 2025-2026 — that part of the work is well-trodden.
