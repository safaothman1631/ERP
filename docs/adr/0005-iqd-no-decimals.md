# ADR-LR-002 — IQD pricing and calculations without decimals

| | |
|---|---|
| **Date** | 2026-05-29 |
| **Authors** | Safa Othman |
| **Reviewers** | Backend lead, Finance ops |
| **Status** | Accepted |
| **Supersedes** | — |
| **Related** | ADR-LR-001 (pricing); `docs/dev/payments-architecture.md` §2; `docs/dev/billing-architecture.md` §1 |

## 1. Context

The Iraqi Dinar (IQD) is denominated such that decimal subunits (the
"fils") are not in practical circulation. The smallest physical
banknote is 250 IQD; the smallest practical cash unit is 250 IQD.
Anything sub-250 IQD has no real-world referent.

Our system handles money across several layers:

* Tenant pricing (we charge tenants).
* Tenant-side sales (tenants charge their customers).
* Tax calculations (VAT-style percentages applied).
* Reporting (P&L, balance sheet, MRR/ARR).

Storing IQD with decimals would let us preserve mathematical precision
on percent calculations but creates these problems:

* No way to represent the rounded number on a receipt without picking a rounding rule.
* Stripe's "minor unit" convention varies per currency — IQD is zero-decimal in Stripe; bringing decimals back would mismatch our integration.
* Iraqi accountants don't post fractional IQD; aligning with their books is necessary.
* Cash payment ergonomics: cashier and customer literally cannot resolve "you owe 12,737.50 IQD".

We also need consistency between display rounding and storage rounding
to avoid the classic "the receipt says 12,750 but the ledger says
12,737.50" reconciliation nightmare.

## 2. Decision

**IQD is stored, computed, and displayed as integer "minor units"
where 1 minor unit = 1 IQD.** All percent-based calculations (tax,
discount) round to the nearest integer **at the line level**, then
sum.

> **One IQD == one minor unit == one integer.** No `.fils` field anywhere.

Implementation:

* All IQD columns in Firestore (and in any local store) are typed
  `int64`. There is no `decimal` IQD path.
* The schema validators (`backend/app/schemas/*`) reject non-integer
  IQD values with a 422.
* Per-line tax: `round(line_subtotal * rate)` using banker's rounding.
* Per-line discount: same.
* Cart total: sum of rounded line totals + tax + tip; no second round.
* USD remains 2-decimal minor units in the same backend, distinguished
  by `currency` field. Mixing currencies in one document is forbidden.

A utility lives at `backend/app/services/iq_money.py` for all IQD
operations (`round_iqd`, `iqd_to_display`, `iqd_to_words`).

## 3. Consequences

### Positive

* Receipts match the ledger exactly. No "tax recon by 0.5 IQD" workflow ever.
* Stripe integration is straightforward — we already pass amounts in minor units.
* Cashier flow is natural: drawer cash, change, all integer.
* Reports are simpler — no display-vs-storage decisions per row.
* TypeScript and Python both handle int64 naturally; no `Decimal` lib needed for IQD.

### Negative

* Some precision lost on multi-step percent calculations (e.g. 7% then 5% on a 12,737 IQD line). We accept up to a 1 IQD drift per line — across a thousand-line invoice this is up to ±1,000 IQD which is small compared to the totals.
* Tax-inclusive vs tax-exclusive computations can diverge by 1 IQD if a tenant reports both — we document the canonical order (per-line tax-exclusive, then summed).
* Tenants who exported data from another system with decimals must accept the rounding when importing.

### Neutral / known unknowns

* If IQD is redenominated by the central bank (a long-discussed
  policy), the migration is a one-time multiply by the conversion
  factor across all integer fields. The decision is reversible.

## 4. Alternatives considered

### Alternative A — Store as Decimal(20, 4)

* **Pros:** Mathematically pure; matches USD model symmetrically.
* **Cons:** Forces a display-rounding decision on every receipt; doubles the surface area of bugs around currency mismatches; Stripe still rejects fractional IQD requiring conversion at the boundary anyway.
* **Why rejected:** Solves a precision problem we don't have, at the cost of bugs at the display boundary.

### Alternative B — Two-tier model (IQD stored as decimal, displayed as integer)

* **Pros:** Theoretically the most precise.
* **Cons:** Receipts and reports must round-trip through the same rounding function or they diverge; "stored decimal, displayed integer" is the most bug-prone shape in money handling.
* **Why rejected:** History of this shape failing in other Iraqi POS systems (per anecdotes from CS conversations).

### Alternative C — Round to nearest 250 IQD (the smallest banknote)

* **Pros:** Matches what the cashier and customer physically resolve.
* **Cons:** Forces a 250 IQD step on prices, breaks subscription line items that need precision (e.g. 35,000 IQD/mo would round to 35,000 which is fine, but a 12,700 IQD line item would round to 12,750 — losing 50 IQD per item silently).
* **Why rejected:** Rounding at this size at the line level distorts totals; better to round-to-1-IQD at the line and let the cashier handle the cash break at the end.

## 5. Validation

We will know we made the right call if:

* Zero reconciliation tickets in 90 days post-launch mentioning "off by less than 250 IQD".
* No P&L vs receipt mismatch tickets at all.
* Tenant accountants confirm during onboarding interviews that integer IQD matches their books.

If we see > 5 tickets in 90 days about line-level rounding drift, we'll
revisit (probably by adding a tenant-configurable rounding policy).

## 6. Notes

* The function `round_iqd` uses banker's rounding (`ROUND_HALF_EVEN`)
  to avoid systematic upward bias.
* USD is stored as 2-decimal minor units in the same backend; the
  `currency` field disambiguates.
* `iqd_to_display` adds the thousands separator (`،` for Arabic
  locale, `,` for English). It does not add a decimal.
* `iqd_to_words` exists for cheque writing (e.g. "ثلاثة وثلاثون ألف
  دينار عراقي فقط" / "تەنها سی و سێ هەزار دیناری عێراقی").

---

*Last reviewed: 2026-05-29 by Safa Othman. Next review: 2026-11-29.*
