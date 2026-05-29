# ADR-LR-006 — Free trial: 90 days

| | |
|---|---|
| **Date** | 2026-05-29 |
| **Authors** | Safa Othman |
| **Reviewers** | Customer Success, Sales |
| **Status** | Accepted |
| **Supersedes** | — |
| **Related** | ADR-LR-001 (pricing); ADR-LR-005 (dunning); `docs/dev/billing-architecture.md` §7 |

## 1. Context

We need to give new tenants enough time to evaluate the product and
migrate their data, but not so much time that they delay paying
indefinitely. The trial length affects:

* Conversion rate (longer trial = more chance to integrate = more sunk cost = higher conversion, but also more time to lose interest)
* Time-to-revenue (longer trial = later revenue per signup)
* Free-rider risk (some tenants will use the product for the trial period as a freebie and churn at billing)
* Onboarding pressure (long trial reduces urgency to actually adopt)

Standard SaaS trial lengths:

| Length | Typical industry | Trade-off |
|--------|------------------|-----------|
| 7 days | Consumer/light SaaS | High urgency; not enough time for B2B onboarding |
| 14 days | Atlassian, Asana | Balanced for self-serve B2B with quick onboarding |
| 30 days | Most enterprise SaaS | Standard "month to evaluate" |
| 60 days | Enterprise with long sales cycles | Multi-stakeholder approval cycles |
| 90 days | Heavyweight ERP, vertical SaaS | Long migration / change-management |

Iraqi market specifics that pull toward longer:

* SMB purchase decisions are slow — owners consult family, accountants, sometimes the imam. A 14-day trial closes before the consultation finishes.
* Most prospects need to migrate data from manual books / Excel / a previous Iraqi accounting system (Al-Ameen, FAS, custom). Migrations take 2-4 weeks of part-time effort.
* The product is a full ERP — it takes weeks to genuinely test invoicing, inventory, POS, payroll. A 14-day trial only tests the surface.
* Trust is built through prolonged use; Iraqi SMBs are wary of foreign-looking SaaS, and a longer trial gives them time to feel ownership.

Iraqi market specifics that pull toward shorter:

* Risk of free-rider: a shop could use us free for 3 months then "try a competitor" — but the data is theirs and the switching cost is real, so this is partially self-limiting.
* Cash flow: longer trial = later first payment = our runway burns more during pre-revenue.

## 2. Decision

**90-day free trial, no credit card required at signup.** Tenants who
want longer can get an extension via CS (sales-assisted). Tenants
who add a payment method during the trial get an immediate "you're set
up for billing on day 91" confirmation; no early-charge surprise.

Implementation:

* Stripe Subscription created with `trial_period_days: 90` at signup.
* `tenants/{id}.billing.trial_ends_at` mirrors the Stripe value.
* Reminders fired at day 75 / 83 / 89 (see ADR-LR-005 cadence).
* At day 90 with payment method: charge.
* At day 90 without payment method: status → past_due, enter dunning at stage 0 (NOT immediate suspension — they get the standard grace).

## 3. Consequences

### Positive

* Matches Iraqi SMB sales cycle — owner can consult, demo to staff, run a parallel month of bookkeeping, then commit.
* Time to migrate from existing systems comfortably.
* Reduces sales-side friction: prospect doesn't feel pressured.
* Builds trust through use — the kind of "we've already entered our data, switching is expensive" sunk cost we want.
* No card required = friction-free signup = higher top-of-funnel.

### Negative

* 90 days of pre-revenue per signup. We must capitalize accordingly.
* Some tenants will be "trial tourists" — sign up, poke around, never commit. Acceptable rate is ~ 60-70% (vs ~ 40-50% for 14-day trials in our research).
* Trial-end reminders need to be well-timed; people forget what they signed up for 3 months ago.
* Without card-at-signup, conversion has more friction at day 90 (card collection is the moment, not signup).

### Neutral / known unknowns

* We don't know yet whether 60 days would convert as well as 90. The "extra 30 days" cost may or may not be necessary. We'll A/B test in year 2 if growth pressure justifies it.
* Some tenants will ask for extensions. The CS playbook allows up to 30 additional days with a documented reason; longer requires VP approval.

## 4. Alternatives considered

### Alternative A — 14 days, no card required

* **Pros:** Industry standard; faster time to revenue.
* **Cons:** Too short for Iraqi SMB sales cycle; ERP isn't a "decide in two weeks" product; would lose deals to "didn't have time to evaluate."
* **Why rejected:** Doesn't match the market.

### Alternative B — 30 days, card required

* **Pros:** Filters out trial tourists; clear billing path.
* **Cons:** Card-at-signup is a major drop-off in Iraq where credit card penetration is lower than US/EU. Many SMBs don't have a corporate card; the owner uses personal. Asking for that upfront is friction.
* **Why rejected:** Card-at-signup friction outweighs filter benefit in this market.

### Alternative C — 30 days, no card required

* **Pros:** Faster to revenue than 90.
* **Cons:** Still too short for serious ERP evaluation; we'd lose deals to "we didn't get to test inventory yet."
* **Why rejected:** 30 days closes mid-evaluation for most.

### Alternative D — Reverse trial (full features 14d → limited free tier forever)

* **Pros:** Top-of-funnel grows; some never convert but they're advocates.
* **Cons:** We don't want a permanent free tier (see ADR-LR-001 rejection of freemium). Operating cost per free tenant isn't zero.
* **Why rejected:** Conflicts with the tier-pricing decision.

## 5. Validation

We will know we made the right call if:

* Trial-to-paid conversion rate is 25-35% (industry benchmark for 90-day trials in this category).
* Median time-from-signup-to-payment-method-added is < 60 days (i.e. most committers commit before the trial ends).
* < 15% of paying customers churn within the first 90 days of paid usage (post-trial churn).
* CS doesn't get more than 1 "trial too short" complaint per 50 prospects.

Revisit if:
* Conversion is below 20% — trial may be too long (tenants disengage), shorten to 60.
* Conversion above 40% with no quality drop — could potentially shorten without harm, capture revenue sooner.
* Trial extensions requested by > 20% of signups — extend default to 120.

## 6. Notes

* The 90-day trial does not include any cap on features or usage. Tenants get full Pro-tier capabilities during trial. This is intentional — we want them to actually load the product.
* At day 91 with no payment method, tenants enter dunning at stage 0 with a custom day-0 email referencing "your trial has ended" (not "your payment failed"). The dunning engine routes this branch.
* Trial extension tool: `python -m backend.app.billing.extend_trial --tenant ... --days N --reason ...`.

---

*Last reviewed: 2026-05-29 by Safa Othman. Next review: 6 months post-launch with cohort data.*
