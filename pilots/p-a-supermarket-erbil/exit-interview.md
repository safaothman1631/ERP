<!-- Worked EXAMPLE exit interview (Day 30). Illustrative content for the toolkit, not a real customer. -->

# Exit Interview — `p-a-supermarket-erbil` — 2026-07-30 (Day 30)

- **Interviewer:** Safa (Founder)
- **Interviewee(s):** Aram (owner/operator); Hevar (cashier)
- **Pilot window:** 2026-06-30 (Day 0) → 2026-07-30 (Day 30)

## 1. Outcome scores (final)

| Metric | Day 14 | Day 30 | Target |
|--------|:------:|:------:|:------:|
| NPS (−100…100) | +40 | +60 | ≥ 30 |
| CSAT (1–5) | 4.0 | 4.4 | ≥ 4 |
| DAU (% of operating days) | 100% | 97% | ≥ 80% |
| Avg transactions/day | ~128 | ~135 | ≥ 50 |

> CSAT facet detail (day 30): Speed 4.6, Reliability 4.6, Receipt printing 4.0, Ease of use 4.4, Support 4.6. Weakest facet = receipt printing (the cold-start glyph and a paper-width tweak); steered two Friday releases.

## 2. The story (for the case study)

**Before us — how did they run the business?**
> A basic cash register for totals + a paper notebook for stock and for regulars' credit (daftar). No real visibility into margins or what was selling.

**The single biggest problem we solved:**
> Kept selling through daily power cuts without losing sales or miscounting the till — and replaced the paper daftar with a real customer-credit ledger.

**Quantified win:**
- Time saved: end-of-day close went from ~40 min (counting + reconciling the notebook) to ~10 min.
- Errors reduced: till mismatches dropped from "a few times a week" to "basically none" after staff trusted the cash-rounding behaviour.
- Throughput: checkout line moves faster at evening peak thanks to reliable barcode scanning.

**Quotable quote (verbatim):**
> "الكهرباء تروح كل يوم بس البيع ما يوقف. وحساب الدفتر صار بالموبايل مو بالدفتر." ("The power goes every day but the selling doesn't stop. And the notebook credit is on the phone now, not in a notebook.") — Aram, owner.
> Consent to publish this quote? **yes** (recorded 2026-07-30).

## 3. What still hurts

- Top 3 things still broken / annoying:
  1. First-print-of-the-morning Arabic glyph occasionally still needs a warm-up print (EC-12) — documented, not yet auto-fixed.
  2. Sell-by-weight is still manual quantity entry (EC-30).
  3. Wants a second terminal for the busy evening shift (expansion, not a defect).
- Anything that almost made them quit? No.
- Missing features that block daily work: none blocking after the daftar feature shipped (PA-005).

## 4. Iraq-specific friction (feeds `iraq-edge-cases.md`)

- IQD rounding / cash handling: works well once discoverable (EC-01). Suggest it's on by default for new shops.
- Power cuts / offline: the headline success (EC-07, EC-08). Held across ~30+ cuts over the month.
- Receipt printing: good after warm-up; paper-width auto-detect worked when he switched roll brands (EC-16).
- USD/IQD: minimal for a grocery; occasional USD note taken, handled manually (EC-03 lower priority for this sector).
- Daftar credit: shipped during the pilot and is now used daily (EC-17).

## 5. Conversion decision (T-SF.6.20)

- **Likely to convert to paid?** **Yes.**
- **At what plan / price?** Retail plan; 40% year-1 discount offered (ADR-112) — accepted.
- **Blocking conditions:** none; wants to add a second terminal at conversion (upsell).
- **Conversion signed?** **Yes — 2026-07-30** (illustrative).

## 6. Reference & case-study rights

- Willing to be a **public reference**? Yes (logo + reference calls).
- Case study: **public**.
- Reviewed & approved the case-study draft? approved 2026-07-31 (illustrative).
- Added to reference roster (CRM)? Yes.

## 7. Hardware return / purchase

- **Purchasing** Kit A on conversion (keeping the loaned hardware) + ordering a second terminal.

## 8. Interviewer notes

> Best-case pilot: high volume, owner-operator on-site daily, offline story landed hard. The daftar feature (shipped day ~11) was the moment he went from "likes it" to "couldn't go back." Strong reference; offered to introduce two other Erbil grocers — feed to the recruiting pipeline. Good lead-in for the board one-pager: "survived 30+ power cuts, zero lost sales, converted to paid."
