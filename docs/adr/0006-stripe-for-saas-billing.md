# ADR-LR-003 — Stripe (not a local provider) for SaaS subscription billing

| | |
|---|---|
| **Date** | 2026-05-29 |
| **Authors** | Safa Othman |
| **Reviewers** | Backend lead, Legal (TBD per R7.7) |
| **Status** | Accepted (pending legal entity formation — R7.7) |
| **Supersedes** | — |
| **Related** | ADR-LR-001 (pricing); ADR-LR-004 (PaymentGateway); design.md §6 ADR-LR-001 (which addresses the same topic from the tenant-side perspective) |

## 1. Context

We need to charge **tenants** a monthly/yearly subscription fee for
using the SaaS. This is distinct from the tenant-side payment problem
(tenants charging their own customers), which is covered separately in
ADR-LR-004.

The technical requirements for SaaS billing:

* Recurring charges with smart retry on decline.
* Multi-currency: IQD for Iraqi tenants, USD for any international tenant we acquire.
* Dunning workflow (failed payment → reminders → suspension).
* Customer portal (tenant updates card, downloads invoices).
* Webhook reliability so our state stays in sync.
* Fraud screening for international card payments.
* Tax handling (zero-rated for Iraq; potentially Stripe Tax for non-Iraq).

The Iraqi market reality:

* No local provider supports recurring subscriptions reliably for SaaS. FastPay, Qi, Zain Cash are checkout/QR payments. Recurring requires "save card" which Iraqi networks barely support.
* Stripe is not available to Iraqi-domiciled legal entities. We need an external entity (US LLC, UK Ltd, or Delaware C-corp) to use Stripe.
* All-cash or all-bank-transfer SaaS billing has been tried by other Iraqi SaaS companies — it's possible but ops-heavy (one finance person per ~ 100 tenants chasing payments).

## 2. Decision

**We will bill SaaS subscriptions through Stripe globally, including
Iraqi tenants who can pay in IQD via Stripe's IQD support.** Manual
bank transfer / cash remains a fallback recorded via the manual-payment
admin tool, but Stripe is the primary path.

**This decision is contingent on R7.7** (forming a non-Iraqi legal
entity that can hold a Stripe account). Until that's done, all
"billing" is manual via the offline tools described in
`docs/runbooks/saas-dunning.md` §4.

Implementation:

* `backend/app/billing/stripe_client.py` wraps the Stripe SDK.
* Plans are mirrored from `backend/app/billing/plans.py` to Stripe via `scripts/bootstrap-stripe.ts`.
* Webhook ingress at `POST /api/saas-billing/webhooks/stripe`.
* Dunning engine consults Stripe's smart retry then escalates per ADR-LR-005.
* Iraqi tenants paying via Stripe in IQD pay no Stripe Tax (Iraq not covered).

## 3. Consequences

### Positive

* We get Stripe's dunning, smart retries, card updater, customer portal — all critical infrastructure we don't need to build.
* International expansion is free (any country Stripe supports is a country we can sell in).
* Fraud screening is included; chargebacks have a defined process.
* Investor-friendly: standard SaaS billing stack means our reporting (MRR, churn) is well-understood.
* PCI scope minimized — we never touch a PAN.

### Negative

* Hard dependency on a non-Iraqi legal entity (R7.7). Until that lands, this ADR is theoretical.
* Stripe fees (~ 2.9% + 30 cents per transaction) eat margin, especially on Starter plan (35,000 IQD × ~ 3% ≈ 1,050 IQD per tx).
* IQD payouts from Stripe to an Iraqi bank account are not direct — funds must route through the external entity's bank, possibly with FX cost.
* If Stripe ever pulls out of Iraq for political/regulatory reasons, we have a single-point-of-failure.

### Neutral / known unknowns

* Stripe's customer support for Iraq edge cases (sanctions screening false-positives, KYC on Iraqi card BINs) is untested at our scale. We may need to build our own appeals queue.

## 4. Alternatives considered

### Alternative A — Build our own subscription engine on top of local rails (FastPay subscriptions or manual bank transfer)

* **Pros:** No legal entity friction. Iraqi tenants pay in IQD directly to an Iraqi account.
* **Cons:** No local provider has reliable recurring; manual bank transfer requires a human chasing every tenant; we'd build dunning, retry, customer portal, invoicing, card updater — easily 6+ months of work that Stripe gives us for free.
* **Why rejected:** Build cost dwarfs the legal-entity cost.

### Alternative B — Hybrid: Stripe for international, manual for Iraq

* **Pros:** Avoids forcing Iraqi tenants through a non-Iraqi entity for billing.
* **Cons:** Two code paths to maintain (this was the original design.md §6 ADR-LR-001 position). Iraqi finance ops cost scales linearly with tenant count.
* **Why rejected:** v1 simplification — we'll start with Stripe-only and add the manual fallback for Iraqi tenants who refuse Stripe (a known scenario). The fallback is the existing manual-payment tool, so we get the hybrid without two billing engines.

### Alternative C — Paddle (merchant of record)

* **Pros:** Paddle handles the entity issue — they're the merchant of record, we're a reseller. No need to form our own US/UK entity.
* **Cons:** Higher take rate (~ 5%+). Less control over checkout UX. Paddle's IQD support is weaker than Stripe's. Their dunning is opinionated and harder to match to Iraq's bank holiday calendar.
* **Why rejected:** Margin hit too large at our price points; less flexibility for the Iraqi market.

### Alternative D — Chargebee + Stripe as gateway

* **Pros:** Chargebee abstracts the billing engine; we can swap gateways later.
* **Cons:** Adds a vendor we don't need at this scale. Stripe's own primitives are enough until we're at hundreds of tenants. Adds monthly cost.
* **Why rejected:** Premature. Re-evaluate at 500+ tenants.

## 5. Validation

We will know we made the right call if:

* Within 3 months of launch: < 5% of tenants explicitly refuse Stripe.
* Stripe fee as % of revenue is < 3.5% (in line with industry).
* Dunning recovery rate is > 60% by stage 14 (industry benchmark).
* No more than one Iraq-specific Stripe issue per month requires manual intervention.

Revisit if:
* Stripe IQD support degrades, OR
* Two local Iraqi providers (FastPay + one other) both ship reliable recurring support, OR
* Our entity-formation cost (R7.7) blocks launch for > 90 days, OR
* We hit 500 tenants and want to switch to a billing engine like Chargebee for more control.

## 6. Notes

* The legal entity formation (R7.7) is the load-bearing prerequisite. Without it, this ADR is aspirational.
* See `docs/dev/billing-architecture.md` for the integration shape.
* See `docs/runbooks/saas-dunning.md` for the runtime operations.
* design.md's ADR-LR-001 is a near-duplicate written earlier; this is the canonical version.

---

*Last reviewed: 2026-05-29 by Safa Othman. Next review: after R7.7 closes or in 6 months, whichever first.*
