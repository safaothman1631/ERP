# ADR-LR-008 — Chart of Accounts: ship templates, not blank-slate

| | |
|---|---|
| **Date** | 2026-05-29 |
| **Authors** | Safa Othman |
| **Reviewers** | Accounting domain expert (TBD), Frontend lead |
| **Status** | Accepted |
| **Supersedes** | — |
| **Related** | `.kiro/specs/launch-readiness` T-LR.3.6, T-LR.3.7; ADR-LR-009 (5-digit Iraqi codes); `docs/runbooks/onboarding-troubleshooting.md` §2 |

## 1. Context

Every new tenant needs a Chart of Accounts (COA) before they can post
journal entries, send invoices, or take payments. Two paradigms:

1. **Blank slate** — let the tenant define every account themselves.
2. **Pre-populated templates** — ship 5-6 industry templates and pick one during onboarding.

Iraqi market specifics:

* Most SMB owners don't know the difference between a chart of accounts and a list of bank accounts. Asking them to define one is a non-starter.
* Accountants in Iraq are familiar with the "Iraqi standard COA" pattern — government-aligned 5-digit codes, asset/liability/equity/revenue/expense order. New systems that don't follow it create friction with the accountant doing the books on the side.
* Industry conventions are strong: retail, restaurant, pharmacy, construction, services each have well-understood standard account sets.
* Mid-migration tenants (coming from FAS, Al-Ameen, or manual books) usually want to mirror their existing COA — not replace it from scratch.

Other ERPs:
* QuickBooks ships ~ 8 country/industry templates.
* Xero ships per-country.
* Iraqi-local systems (Al-Ameen, FAS) ship a default Iraqi COA per industry.

If we ship blank-slate, every tenant either:
- Asks their accountant to define one (delayed onboarding by 1-2 weeks), OR
- Picks one ad-hoc from Google (incoherent), OR
- Abandons.

If we ship templates, the risk is the template doesn't match the
tenant's actual books, requiring rework later.

## 2. Decision

**We ship 5 industry COA templates at launch — General, Retail,
Restaurant, Pharmacy, Construction — pre-populated during the
onboarding wizard. The tenant picks one and we instantiate the
accounts into their workspace. Customization (add/edit/disable
accounts) is encouraged but not required to proceed.**

Implementation:

* Templates live at `backend/app/data/coa_templates/<name>.yaml` and are
  source-controlled (versioned via a `template_version` field).
* `POST /api/onboarding/coa/apply { template_id, tenant_id }` writes
  the accounts into `tenants/{id}/accounts/`.
* The step is **idempotent within a session** and **conflict-checked
  cross-session** (re-applying refuses if accounts already exist —
  see onboarding-troubleshooting.md §2).
* Each template has its accounts coded per ADR-LR-009 (5-digit Iraqi
  convention).
* Templates ship in Kurdish + Arabic + English labels for every
  account.

## 3. Consequences

### Positive

* Tenants can finish onboarding in one sitting without bothering their accountant.
* Industry templates encode best-practice account hierarchies — most tenants accept them as-is.
* Aligns with Iraqi accountant expectations (5-digit, standard order).
* First sale, first invoice, first expense entry all work on day one.
* Templates can evolve in a code release — we improve the default for everyone.

### Negative

* Templates may not match a tenant's existing books. When this is true and they don't notice during setup, the mismatch surfaces later when their accountant rejects the export.
* We carry ongoing responsibility for the templates' accounting correctness. If we ship a bad template, every tenant on it has a problem.
* Customization-after-setup creates a sub-problem: tenants disable accounts they don't need, then later wonder why they can't post to them.
* Five templates is opinionated. Edge industries (e.g. agriculture, NGO) won't find theirs.

### Neutral / known unknowns

* We don't yet have an accounting expert on staff who can certify the templates are GAAP-aligned for Iraq. We've sourced them from Iraqi accountant friends-of-friends. Pre-GA, we get them formally reviewed.
* The "verified by" stamp on each template (with date) signals freshness and lets tenants see when it was last sanity-checked.

## 4. Alternatives considered

### Alternative A — Blank slate

* **Pros:** Maximum flexibility; no accidental misalignment with tenant's books.
* **Cons:** Onboarding delays of 1-2 weeks; high abandonment rate; no path for tenants without an accountant on call.
* **Why rejected:** Onboarding completion is the metric we care most about; blank-slate fails it.

### Alternative B — Import from CSV

* **Pros:** Tenants migrating from another system bring their books exactly.
* **Cons:** Doesn't help new SMBs without an existing COA; CSV format requires data hygiene; we'd still need defaults for fields not in the CSV.
* **Why rejected:** Solves the wrong problem (we have very few tenants migrating from a system with a clean export).

### Alternative C — One generic template, no industry split

* **Pros:** Simpler to maintain.
* **Cons:** Restaurants and pharmacies have very different account needs (COGS structure, inventory categories). A generic template forces customization for every industry.
* **Why rejected:** Increases customization burden without saving meaningful template-authoring time.

### Alternative D — AI-generated COA from a tenant description

* **Pros:** Most personalized.
* **Cons:** Hallucination risk in a domain (accounting) where precision matters; we'd need to validate against accounting principles; complex review UX.
* **Why rejected:** Premature for v1.

## 5. Validation

We will know we made the right call if:

* > 85% of tenants finish the COA step without contacting CS.
* > 70% of tenants run their first month-end close without changing more than 10% of the template's accounts.
* < 5% of tenants ask for a custom template that doesn't fit our 5.
* < 2 templates per quarter need correction post-launch.

Revisit if:
* The 5-template split is wrong (e.g. > 20% of tenants pick "General" because none of the verticals fit). Add or split.
* An accountant audit finds compliance issues — fix templates in a release.
* Tenants' accountants frequently reject the template after handoff (> 15%) — we'd add a per-account "verified for IQ" tag.

## 6. Notes

* Verticals not in v1 (agriculture, NGO, hospital, hotel, etc.) get a generic "Other" path that uses the General template. We'll add per-vertical templates if signups justify.
* Each template ships with a small "About this template" note (~ 200 words) explaining what it covers, who it's for, and what to customize.
* The CFO of one of our beta customers reviewed the Restaurant template in April 2026 (pre-spec). Other templates pending similar review.

---

*Last reviewed: 2026-05-29 by Safa Othman. Next review: after first 50 tenants onboarded, with template-fit data.*
