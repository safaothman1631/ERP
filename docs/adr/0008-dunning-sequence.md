# ADR-LR-005 — Dunning sequence day-3 / 7 / 14 / 30

| | |
|---|---|
| **Date** | 2026-05-29 |
| **Authors** | Safa Othman |
| **Reviewers** | Finance ops, Customer Success |
| **Status** | Accepted |
| **Supersedes** | — |
| **Related** | `.kiro/specs/launch-readiness` T-LR.5.5; `docs/runbooks/saas-dunning.md` §1; `docs/dev/billing-architecture.md` §4 |

## 1. Context

When a tenant's monthly/yearly payment fails, we need a defined
sequence of reminders → service restriction → suspension →
termination. The shape of this sequence affects:

* Revenue recovery rate (more reminders = more chances to recover)
* Customer experience (too many reminders = annoyed, churned)
* Support load (every email triggers replies)
* Legal exposure (we must give reasonable notice before suspension)
* Cash flow predictability

Industry benchmarks for SaaS dunning (from Recurly, ProfitWell, Vindicia
published data):

| Approach | Recovery rate | Notes |
|----------|---------------|-------|
| No dunning | ~ 15% | Pure auto-retry by gateway |
| Light (1-2 emails) | ~ 35% | Email-only, no service change |
| Standard (3-4 emails over 14d) | ~ 60% | Email + soft restriction |
| Aggressive (5+ touches over 30d) | ~ 70% | Email + SMS + phone + suspension |

Iraqi market specifics:

* Cash flow at SMBs is lumpy — a missed payment is often "I'll pay next week when I deposit cash from sales" rather than "I'm churning."
* Bank holidays (Eid x2, Newroz, etc.) compress the working window unpredictably.
* SMS is high-trust in Iraq (more attention than email).
* Phone calls from a recognized number get answered; from an unknown number, rarely.

## 2. Decision

**We use a 5-touch sequence: day 0 (failure), day 3, day 7, day 14,
day 30, with two terminal stages at day 90 (pending deletion) and day
120 (deletion).** Service degrades gradually: full access through day
13, read-only days 14-29, suspended days 30-89, deletable from day 90.

| Day | Action | Service state |
|-----|--------|---------------|
| 0 | Email + in-app banner | Full access |
| 3 | Email + SMS | Full access |
| 7 | Email + SMS + login modal | Full access (modal must dismiss) |
| 14 | Email + SMS + phone (Pro) | Read-only |
| 30 | Email "suspended" | Suspended (export only) |
| 90 | Email "deletion in 30 days" | Suspended |
| 120 | Final email + delete (after legal) | Terminated |

Iraqi calendar awareness:
- Multi-day bank holidays extend timers by holiday length.
- Ramadan: day-3 and day-7 extend by ~ 2 days; later stages remain.
- Dec 15 - Jan 15: suspension threshold extends to day-45 for tenants > 6 months tenured.

(Full mechanics in `docs/runbooks/saas-dunning.md`.)

## 3. Consequences

### Positive

* 5 touches over 30 days lands in the "standard to aggressive" recovery range; we expect ~ 60-65% recovery.
* Gradual service degradation gives the tenant time to react before they're locked out — fewer surprise churn moments.
* Iraq calendar awareness avoids us sending a "your payment failed" reminder during Eid (which would be both ineffective and rude).
* Day-14 phone call for Pro tenants captures high-value at-risk accounts without scaling CS for every tier.
* Day-30 suspension is far enough out to feel fair; day-90 deletion gives time for export.

### Negative

* 5 touches over 30 days is more than some tenants will tolerate; we'll get "unsubscribe / stop emailing me" requests, which we must respect for marketing but cannot for billing notices.
* SMS adds vendor cost (Twilio or local SMS gateway). Per-tx cost in Iraq is ~ 0.04 USD; at 5% past-due rate, this is small but non-zero.
* Phone outreach scales linearly — we can't grow Pro past CS capacity without revisiting.
* Calendar awareness adds operational complexity (the holiday YAML must stay accurate).

### Neutral / known unknowns

* The exact day-3 / 7 / 14 / 30 split is based on industry benchmarks, not our own data. After 6 months of dunning data we may compress to day-2 / 5 / 10 / 25 or expand to day-5 / 10 / 20 / 45.
* Recovery rate in Iraq specifically may differ from published US/EU benchmarks. We instrument every transition for analysis.

## 4. Alternatives considered

### Alternative A — Aggressive (day 1 / 3 / 7 / 14 / 21)

* **Pros:** Higher recovery rate (~ 70%).
* **Cons:** Annoying; risks brand damage; Iraqi market would experience this as "spammy"; suspension at day 21 feels too soon for SMBs with monthly cash cycles.
* **Why rejected:** Cultural fit; risk of churn from over-messaging exceeds recovery upside.

### Alternative B — Light (day 7 / 14, suspend at 30)

* **Pros:** Less annoying; lower CS load.
* **Cons:** Recovery rate drops to ~ 35-45%; misses the "saved my forgotten payment" cohort.
* **Why rejected:** Leaves too much revenue on the table.

### Alternative C — Stripe-only dunning (rely on Stripe's smart retries + their email)

* **Pros:** Zero work for us.
* **Cons:** Stripe's emails are generic, not branded, not in Kurdish/Arabic; Stripe's retry schedule doesn't know about Iraqi bank holidays; no SMS or phone fallback.
* **Why rejected:** Localization gap; Iraq calendar gap.

### Alternative D — Manual outreach (no automation)

* **Pros:** Most personal; highest recovery on the calls we make.
* **Cons:** Doesn't scale past ~ 100 tenants; relies on a single CS person remembering.
* **Why rejected:** Doesn't scale.

## 5. Validation

We will know we made the right call if:

* Recovery rate is 55-65% by day 14 within the first 6 months.
* < 10% of churned tenants cite "too many emails" as a reason in exit surveys.
* < 2% of dunned tenants escalate to support claiming they didn't receive notice.
* The Iraq calendar logic correctly extends 100% of multi-day holidays (audit quarterly).

Revisit if:
* Recovery rate is below 40% — sequence too soft, tighten.
* Recovery rate is above 75% but churn citing dunning is above 15% — sequence too aggressive.
* Iraq calendar isn't keeping up (e.g. national holidays added without a config update).

## 6. Notes

* Industry references: ProfitWell's 2024 dunning benchmark report; Recurly's "Recovering Failed Payments" guide.
* The sequence is implemented in `backend/app/billing/dunning/stages.py` — each stage is a pure function so the policy is reviewable in one place.
* Templates in `backend/app/billing/templates/dunning/` keyed by `(stage, language)`.

---

*Last reviewed: 2026-05-29 by Safa Othman. Next review: 6 months post-launch.*
