# ADR-LR-009 — Iraqi 5-digit Chart of Accounts code convention

| | |
|---|---|
| **Date** | 2026-05-29 |
| **Authors** | Safa Othman |
| **Reviewers** | Accounting domain expert (TBD) |
| **Status** | Accepted |
| **Supersedes** | — |
| **Related** | ADR-LR-008 (COA templates); `.kiro/specs/launch-readiness` R2.4; `backend/app/data/coa_templates/*.yaml` |

## 1. Context

Every account in our COA needs a stable identifier that is:

* Visible to tenants (printed on reports, journal entries, statements).
* Sortable in a meaningful order (asset/liability/equity/revenue/expense).
* Compatible with how local accountants (the people who actually use the books) think.
* Big enough to allow new accounts to be inserted without renumbering.

Conventions in the wild:

| Convention | Width | Order | Used by |
|------------|-------|-------|---------|
| IFRS-style narrative | none | none | International public companies; not SMB-friendly |
| US GAAP 3-4 digit | 3-4 | Asset 1xx, Liab 2xx, Equity 3xx, Rev 4xx, Exp 5xx | QuickBooks, US SMBs |
| French PCG | 1-8 digit hierarchical | Class 1-8 with deep sub-coding | French and former French colonies |
| Iraqi standard | 5 digit | Asset 1xxxx, Liab 2xxxx, Equity 3xxxx, Rev 4xxxx, Exp 5xxxx | Iraqi accountants, KRG ministries, government-aligned local SMB |
| German SKR-04 | 4 digit | Hierarchical | German SMB; not relevant here |

For our tenants:

* Iraqi accountants — the ones doing month-end books — read 5-digit codes natively. A QuickBooks 4-digit code requires translation.
* Government filings (tax returns, where the company has any government contract revenue) expect codes that look like government codes.
* New Iraqi accountants are trained on 5-digit Iraqi standard in accounting schools.
* The KRG Ministry of Finance publishes a 5-digit standard for state-owned enterprises that has bled into private sector practice.

## 2. Decision

**Account codes are 5-digit integers, in ranges:**

| Range | Class | Notes |
|-------|-------|-------|
| 10000 - 19999 | Assets | 10xxx current, 11xxx fixed, 12xxx other |
| 20000 - 29999 | Liabilities | 20xxx current, 21xxx long-term |
| 30000 - 39999 | Equity | 30xxx capital, 31xxx retained, 32xxx other |
| 40000 - 49999 | Revenue | 40xxx sales, 41xxx other income |
| 50000 - 59999 | Expenses | 50xxx COGS, 51xxx operating, 52xxx finance, 53xxx tax |
| 60000 - 99999 | Reserved | for future extension (e.g. statistical accounts, gain/loss separations) |

Implementation:

* Account code is a TypeScript `number` typed as `IqAccountCode = number & { __brand: 'IqAccountCode' }` to discourage non-Iraqi-shaped codes elsewhere.
* `POST /api/accounts` auto-generates the next available code in the requested class if none provided (T-LR.R2.4).
* The parent_id type/class is validated to match the child's intended class (an asset cannot be a child of a revenue account).
* Range gaps (e.g. 10001 through 10099 in a template) allow tenants to insert custom sub-accounts.

## 3. Consequences

### Positive

* Iraqi accountants can use our exports without translation.
* Tenants' month-end packets look "Iraqi" — important for trust.
* 5-digit gives ~ 9000 codes per class, far more than any SMB will use.
* Auto-generation in templates ensures new accounts always land in the right class.
* The branded TypeScript type prevents an account code from being passed where, say, a tenant ID is expected.

### Negative

* Tenants migrating from QuickBooks or another 3-4 digit system need code remapping at import.
* The 5-digit convention is informally standard in Iraq but not codified by any specific regulation. We rely on it being de-facto rather than de-jure.
* Templates from international sources (e.g. IFRS-aligned) need recoding before we can ship them.

### Neutral / known unknowns

* If Iraq adopts a different national chart (e.g. as part of e-invoicing / VAT reform), we'd migrate. The risk is low — successive Iraqi finance reforms have preserved the 5-digit shape.
* The KRG region may have parallel sub-conventions — TBD whether to fork templates per region.

## 4. Alternatives considered

### Alternative A — IFRS-aligned 4-digit

* **Pros:** Internationally portable; aligns with public-company reporting.
* **Cons:** Doesn't match local accountant expectation; tenants would still need to map to Iraqi codes for any local filing.
* **Why rejected:** We serve SMBs in Iraq, not multinationals.

### Alternative B — US GAAP 3-4 digit (1xxx Assets, 2xxx Liabilities, etc.)

* **Pros:** Familiar to engineers who've used QuickBooks; same shape as `coa_templates/*.yaml` files in some open-source ERPs.
* **Cons:** Iraqi accountants would have to translate. Government filings expect 5-digit.
* **Why rejected:** Imposes a translation tax on every interaction with an accountant.

### Alternative C — Numeric codes are surrogate IDs only; humans see names

* **Pros:** No convention to defend.
* **Cons:** Iraqi accountants asked for codes specifically; they sort and reference by code in meetings.
* **Why rejected:** Loses the audience.

### Alternative D — Free-form alphanumeric codes (e.g. "SALES-001")

* **Pros:** Maximum flexibility.
* **Cons:** Breaks the sortable-by-class convention; conflicts with import/export tooling that expects integers; no native sort order.
* **Why rejected:** Loses too much for marginal flexibility.

## 5. Validation

We will know we made the right call if:

* Iraqi accountants reviewing our books for our beta customers don't ask us to renumber.
* < 5% of tenants override the default codes in templates.
* Imports from FAS / Al-Ameen / Excel sheets succeed with > 90% of source codes mappable 1:1 (most are already 5-digit).
* No tax filing or audit cites a code-format issue.

Revisit if:
* Iraq or KRG publishes an official chart with a different shape.
* Most beta tenants override > 25% of template codes (signals templates are wrong, not the convention).

## 6. Notes

* The branded TypeScript type lives in `frontend/src/types/index.ts` (`IqAccountCode`). The Python equivalent is a `NewType('IqAccountCode', int)` in `backend/app/types.py`.
* The reserved 60000-99999 range gives future room — e.g. for statistical accounts that some Iraqi companies use for management reporting separately from financial accounts.
* For the auto-generation algorithm: T-LR.R2.4 of `_deltas/launch-readiness-REMAINING-WORK.md` notes the range 10000-59999 must be respected; we pick the lowest available code in the requested class.

---

*Last reviewed: 2026-05-29 by Safa Othman. Next review: after first 20 tenants' accountants review their books.*
