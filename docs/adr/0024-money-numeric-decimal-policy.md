# ADR 0024 — Money & numeric policy: Decimal end-to-end, ROUND_HALF_UP, 2dp; ban float in financial paths

| | |
|---|---|
| **Date** | 2026-06-03 |
| **Authors** | Safa Othman |
| **Reviewers** | Backend lead, Accounting/Finance reviewer, Tech lead |
| **Status** | Proposed |
| **Supersedes** | — |
| **Related** | ADR-0005 (IQD no decimals); ADR-0012 (5-digit CoA); ADR-0021 (Postgres ledger / `NUMERIC`); `_deltas/P0-finance-correctness-IMPLEMENTATION.md` (the finance guide); `backend/app/services/tax_calc.py`; `backend/app/tax/withholding.py`; `backend/app/services/reports_v2.py`; `backend/app/services/je_validation.py`; `backend/app/services/journal_entry_atomic.py`; `backend/app/services/invoice_payments.py` |

## 1. Context

This is an accounting product; money must be **exact and reproducible**. Today it is not, in identifiable places. The P0 finance review (`_deltas/P0-finance-correctness-IMPLEMENTATION.md`) found, and a code read confirms, that financial math is done in binary `float` with a rounding hack:

* **The `1e-9` epsilon hack.** Both tax rounders nudge every value upward before rounding to dodge Python's round-half-to-**even**:
  * `backend/app/services/tax_calc.py:17` — `_round(value) → round(value + 1e-9, 2) if value >= 0 else -round(-value + 1e-9, 2)`. This `_round` is applied to subtotals, tax totals, withholding, line totals, and grand totals across invoices.
  * `backend/app/tax/withholding.py:128–131` — the **same** hack, with a comment claiming "half away from zero … matches `tax_calc._round`." It only *approximates* HALF_UP and is **non-deterministic at tie-points** (the `+1e-9` doesn't reliably tip every `…5` case the same way at all magnitudes).
* **Float accumulation in the GL/report path.** `backend/app/services/reports_v2.py:91–93` seeds `{"debit": 0.0, "credit": 0.0}` and does `d["debit"] += float(ln.get("debit", 0) or 0)` per line, then `round(x, 2)` at the end. Trial Balance, P&L, Balance Sheet, and Cash Flow all fold ledger amounts in `float`, accumulating binary error before the final round.
* **Payment math in float.** `invoice_payments._invoice_balance_after` computes `balance_due` in `float` and closes an invoice at `<= 0`, which can leave a sub-cent residue stuck as "partially_paid."

What is **already correct** and worth protecting: the double-entry validator `je_validation.validate_je_balance` checks debits==credits using **`Decimal`** with a per-currency tolerance (`IQD = Decimal("0.005")`), and `journal_entry_atomic` posts entries transactionally. So the *balance check* is Decimal; the *amounts being checked and reported* are float. That mismatch is the gap.

Risk if unaddressed: sub-cent drift that compounds across many lines, **non-deterministic rounding at tie-points** (the same invoice can round differently depending on float representation), and audit failures where recomputation doesn't reproduce stored totals. For a system that also owes tax/e-Fakhata figures to the Iraqi MoF, this is a compliance exposure, not just an aesthetic one.

Note ADR-0005 ("IQD without decimals"): IQD is conventionally whole-dinar, but the GL tolerance is `0.005` and multi-currency/tax math produces fractional intermediates, so the policy quantises to **2dp** consistently and lets display drop decimals for IQD — the two ADRs are compatible.

## 2. Decision

**All money and tax arithmetic uses Python `Decimal`, end-to-end, rounded `ROUND_HALF_UP` to 2 decimal places via one shared helper. `float` is banned in financial code paths. The `+1e-9` rounding hack is removed.**

* **Single rounding policy:** `Decimal`, **`ROUND_HALF_UP`**, **2dp**. One helper, reused everywhere:

  ```python
  from decimal import Decimal, ROUND_HALF_UP
  _CENT = Decimal("0.01")
  def money(value) -> Decimal:
      d = value if isinstance(value, Decimal) else Decimal(str(value or 0))  # str(), never Decimal(float)
      return d.quantize(_CENT, rounding=ROUND_HALF_UP)
  ```

* **Parse via `str()`, never `Decimal(float)`** — constructing a Decimal from a binary float carries the very error we are removing.
* **Remove the hack:** replace `tax_calc._round` and `withholding._round` (the `round(x + 1e-9, 2)` bodies) with the `Decimal`/`ROUND_HALF_UP` implementation. The code comment already *claims* "half away from zero" — make it true. (`ROUND_HALF_UP` rounds ties away from zero deterministically, which is exactly the intended behaviour.)
* **Decimal in the GL/report fold:** `reports_v2._aggregate_lines` accumulates in `Decimal`, not `float`; quantise once at the boundary.
* **Decimal in payment math:** `invoice_payments._invoice_balance_after` does balance arithmetic in `Decimal` and closes at `<= 0.01` (matching the AP side `bill_payments._bill_balance_after`), eliminating the stuck-residue bug.
* **Persistence boundary:** Firestore stores numbers as float; we **keep the float at the storage edge** but do **all arithmetic and comparisons in `Decimal`**, quantising on the way in and on the way out. A future relational ledger (ADR-0021) uses `NUMERIC(18,2)` so the store itself is exact.
* **Enforcement:** the policy is documented in the engineering handbook's finance section, and financial-path changes are gated by the full `pytest` suite — including the property tests in `test_accounting_integrity.py` (debits==credits for arbitrary inputs) plus new tie-point tests (per the finance guide §5).

The detailed, file-by-file apply plan already exists in `_deltas/P0-finance-correctness-IMPLEMENTATION.md` (Fix 3, plus the related GL auto-post Fixes 1 & 2). That guide is the implementation companion to this ADR. It is **REVIEWED but NOT YET APPLIED** — money changes must be verified by the full backend suite on Windows (the sandbox can't run it), which is why this ADR is **Proposed** rather than Accepted.

## 3. Consequences

### Positive

* **Deterministic, reproducible money.** `ROUND_HALF_UP` rounds ties the same way every time, independent of float representation — recomputation reproduces stored totals, which is the core audit requirement.
* **No accumulating drift.** Decimal accumulation in the GL fold removes the per-line binary error that float `+=` introduces before rounding.
* **Closes real bugs.** The sub-cent "partially_paid forever" residue disappears; the tie-point ambiguity in withholding/tax disappears.
* **Consistent with what already works.** The Decimal balance validator (`je_validation`) and the new Decimal arithmetic now speak the same number type — the amounts checked are computed the same way they are validated.
* **Compliance-safe.** Tax/withholding/e-Fakhata figures become exact and defensible to the MoF.

### Negative

* **Touches money code — highest blast radius.** `tax_calc._round` feeds invoice totals consumed across the app; changing its rounding is a behaviour change that **must** be validated by the full suite, not a sandbox check. The finance guide deliberately stages it (do `withholding` + `invoice_payments` first, then `tax_calc`) to limit risk.
* **Decimal is more verbose and marginally slower** than float. Acceptable: financial paths are not hot loops, and correctness dominates.
* **Boundary discipline forever.** Every new financial field must parse via `money()`/`str()` and never reintroduce `float(...)` or `Decimal(float)`. Needs a lint rule and review vigilance to hold.
* **Historical data unchanged by the policy alone.** Totals already stored from float math aren't retroactively corrected; the finance guide's backfill/reconciliation (§6) is a separate, careful task.

### Neutral / known unknowns

* **Display vs storage.** IQD display still drops decimals (ADR-0005); the 2dp Decimal is the *computation/storage* contract, not the presentation one.
* **Tolerance alignment.** The GL validator's `IQD = 0.005` tolerance stays; quantising to 2dp sits comfortably inside it.

## 4. Alternatives considered

### Alternative A — Keep `float` + the `1e-9` hack

* **Pros:** zero change.
* **Cons:** non-deterministic at tie-points; accumulating drift; audit non-reproducibility; the documented P0 finding.
* **Why rejected:** this is the bug. An accounting system cannot ship non-deterministic money rounding.

### Alternative B — Store and compute money as **integer minor units** (fils/dinar-cents)

* **Pros:** exact, fast, no rounding type at all; common in payments systems.
* **Cons:** a larger refactor (every amount field changes type and meaning) on a live schema; mixed-currency and percentage tax/withholding still need a rounding decision somewhere; bigger blast radius than the Decimal swap; Firestore + existing code assume decimal-valued amounts.
* **Why rejected (for now):** Decimal gets exactness with far less churn against the current data model. Integer minor units remain a viable long-term option, especially alongside a relational ledger (ADR-0021).

### Alternative C — Banker's rounding (ROUND_HALF_EVEN) in Decimal

* **Pros:** statistically unbiased over many roundings; Python's float default.
* **Cons:** the codebase's stated intent is "half **away from zero**," and common invoice/tax expectations (and the existing tests) assume HALF_UP; switching to HALF_EVEN would change customer-visible totals and contradict the code's own comments.
* **Why rejected:** match the documented intent and existing test expectations — HALF_UP.

### Alternative D — A money library (e.g. `py-moneyed`)

* **Pros:** typed Money (amount+currency), arithmetic guards.
* **Cons:** a dependency and a type migration; multi-currency policy lives in our domain already (`currency_converter`, `je_validation` tolerances); the one-helper Decimal approach is lighter and sufficient.
* **Why rejected:** unnecessary weight; revisit if multi-currency money handling grows complex.

## 5. Validation

We will know this is right if:

* **The `1e-9` hack is gone** from `tax_calc._round` and `withholding._round`, replaced by `Decimal`/`ROUND_HALF_UP`, and `grep -rn "1e-9" backend/app` over financial paths returns nothing.
* **Tie-point tests pass deterministically** (finance guide §5): e.g. `100.50 × 5% = 5.025 → 5.03`, `83.10 × 2% = 1.662 → 1.66`; and `gross − withheld == net` exactly to 2dp for large amounts.
* **The accounting property tests stay green** — `test_accounting_integrity.py` proves debits==credits for arbitrary inputs; a new property test proves the invoice builder always balances; reports reconcile to the JE source after the Decimal fold.
* **No `float(` or `Decimal(<float>)` reappears** in financial modules (enforced by lint + review).
* The full backend `pytest` suite passes **on Windows** before any of this ships (the gating condition that keeps this ADR Proposed until applied).

## 6. Notes

* Implementation companion: `_deltas/P0-finance-correctness-IMPLEMENTATION.md` — exact file-by-file plan (Fix 3 = this policy; Fixes 1–2 = the related GL auto-post gap), staged commits, test plan, and backfill/reconciliation steps. Apply on a branch, validate with the full suite, do **not** push to `main` unverified.
* Verified findings: `tax_calc.py:17` and `withholding.py:128–131` use `round(x + 1e-9, 2)`; `reports_v2.py:91–93` accumulates `float`; `invoice_payments._invoice_balance_after` is float and closes at `<= 0`; `je_validation.validate_je_balance` already uses `Decimal` with `IQD = 0.005` tolerance.
* Compatible with ADR-0005 (IQD display has no decimals) — 2dp is the compute/storage contract; and forward-compatible with ADR-0021 (`NUMERIC(18,2)` in a relational ledger).

---

*Last reviewed: 2026-06-03 by Safa Othman. Next review: when the P0 finance fixes are applied + validated on Windows (flip to Accepted), or sooner if any money-rounding defect is reported.*
