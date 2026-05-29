# ADR-LR-001 — Tier-based pricing: Starter / Growth / Pro

| | |
|---|---|
| **Date** | 2026-05-29 |
| **Authors** | Safa Othman |
| **Reviewers** | Pricing committee (TBD) |
| **Status** | Accepted |
| **Supersedes** | — |
| **Related** | `.kiro/specs/launch-readiness` R5; `docs/dev/billing-architecture.md` §1 |

## 1. Context

We need a price model that:

* Maps to how small/medium Iraqi businesses think about software cost (predictable monthly fee, not a meter).
* Gives us obvious upsell paths as a tenant grows.
* Doesn't require a salesperson on every deal — most of our pipeline is self-serve via the website.
* Captures meaningful revenue at the high end where we'll do a lot of CS work.

Our market: corner shops, restaurants, small clinics, mid-sized
distributors, small construction firms. They prefer flat fees they can
budget for, not per-seat counters they have to police.

The team is 4 engineers — we can't operate a complex pricing engine
with custom quotes per tenant in v1.

## 2. Decision

**We will price in three tiers — Starter, Growth, Pro — with hard caps
on users, storage, and POS terminals per tier.** Prices in both IQD
and USD; yearly billing offers ~ 17% discount.

| Tier | IQD/mo | USD/mo | Users | Storage | POS terminals |
|------|--------|--------|-------|---------|---------------|
| Starter | 35,000 | 25 | 3 | 5 GB | 1 |
| Growth | 95,000 | 75 | 10 | 50 GB | 3 |
| Pro | 250,000 | 200 | 50 | 500 GB | 10 |

A tenant that wants more than Pro provides goes through enterprise
sales (manual contract, not in product flow).

Implementation: `backend/app/billing/plans.py` is the single source of
truth; Stripe Products/Prices are derived from it via
`scripts/bootstrap-stripe.ts`.

## 3. Consequences

### Positive

* Self-serve flow doesn't need a quote calculator.
* Three SKUs are easy to A/B test and easy to remember in CS calls.
* Hard caps create natural upgrade triggers (tenant hits the cap → we email "you're 90% to your user limit").
* IQD pricing rounds nicely (35k / 95k / 250k are typical Iraqi mental anchors).

### Negative

* Tenants on the seam (e.g. 11 users) feel forced to skip a tier. We accept this; the alternative is per-seat sprawl.
* Storage cap is the most arbitrary number — we may need to widen it once usage data lands.
* No add-ons in v1 (e.g. "extra POS terminal +5k IQD"). Add-ons will come once we have data on what tenants ask for.

### Neutral / known unknowns

* USD vs IQD relative pricing assumes a 1,400 IQD/USD exchange rate. If IQD swings hard, we revisit.
* "Growth" is the assumed modal tier; we'll know after 30 days of sign-ups whether the conversion ratio matches the price-architecture hypothesis.

## 4. Alternatives considered

### Alternative A — Per-user pricing (5 USD/user/month)

* **Pros:** Industry-familiar (Slack, Notion); customers think they "pay for what they use."
* **Cons:** Tenants game it by sharing logins. Encourages anti-pattern of one super-user. Iraqi SMBs often pay one big bill, not per-headcount; this confuses them. Hard to map to POS (the cashier is a "user" but a POS shift isn't quite an FTE).
* **Why rejected:** Doesn't match how target market thinks; encourages credential sharing.

### Alternative B — Per-tenant flat fee (one price, all features)

* **Pros:** Simplest possible model; one number on the website.
* **Cons:** No upsell path; either too high (turns away starters) or too low (we never capture enterprise value). Iraqi market in particular won't pay 200 USD/month on day one with no smaller plan.
* **Why rejected:** Leaves money on the table from the top; locks out the bottom.

### Alternative C — Usage-based (per invoice, per transaction)

* **Pros:** Fairest in theory; small users pay small.
* **Cons:** Customers hate unpredictable bills. Hard to budget. Hard to forecast our own revenue. Requires a metering pipeline we don't have. Causes "scared to use the product" UX.
* **Why rejected:** SMBs want a predictable line item.

### Alternative D — Free + premium add-ons (freemium)

* **Pros:** Lowest acquisition friction.
* **Cons:** We're already giving 90-day trial (ADR-LR-006); a free tier on top would dilute paid signups in the Iraqi market where competing freeware is rare. Also raises support cost.
* **Why rejected:** 90-day trial is enough top-of-funnel for v1.

## 5. Validation

We will know we made the right call if:

* Within 6 months: at least 40% of paying tenants are on Growth (the modal tier hypothesis).
* No more than 15% of churn is "upgrade-required-too-soon" or "tier-cap-too-restrictive" (i.e. tier seams aren't a churn driver).
* Median sales cycle for Pro is under 30 days (i.e. the price isn't blocking the high end).

Review in 6 months. Revisit pricing in 12 months as data accumulates.

## 6. Notes

* Yearly discount math: 12 × 35,000 × 0.83 ≈ 348,600 → list 350,000 IQD/year (Starter).
* Stripe Price IDs are stored in `backend/app/data/stripe_price_ids.yaml` after bootstrap.
* Reference: Pricing patterns in Iraqi SaaS (Snoonu, Toters' merchant tiers) skew toward 2-3 flat tiers with caps; that informed our split.

---

*Last reviewed: 2026-05-29 by Safa Othman. Next review: 2026-11-29.*
