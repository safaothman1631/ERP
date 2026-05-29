# Developer Guide — SaaS Billing Architecture

> **Spec ref:** `.kiro/specs/launch-readiness` Phase R5
> **Audience:** Backend devs working on subscription billing
> **Scope:** How WE bill OUR tenants for the SaaS subscription. Not tenant-side payments (see [`payments-architecture.md`](./payments-architecture.md)).

This doc explains:
- Stripe integration shape
- The dunning engine
- Plan changes (upgrade / downgrade)
- Proration logic
- Trial enforcement
- Sequence diagrams

---

## 1. The plans

Three tiers (ADR-LR-001). Pricing in `backend/app/billing/plans.py`:

| Tier | IQD/mo | USD/mo | Users | Storage | POS terminals |
|------|--------|--------|-------|---------|---------------|
| Starter | 35,000 | 25 | 3 | 5 GB | 1 |
| Growth | 95,000 | 75 | 10 | 50 GB | 3 |
| Pro | 250,000 | 200 | 50 | 500 GB | 10 |

IQD has no decimals (ADR-LR-002). Yearly billing offers ~ 17% discount.

The plans bootstrap into Stripe via:
```bash
npx tsx scripts/bootstrap-stripe.ts
```
It creates Products + Prices in Stripe and writes the Price IDs back
into `backend/app/data/stripe_price_ids.yaml`.

---

## 2. Why Stripe (and only Stripe)

See ADR-LR-003 for the full rationale. Short version: Stripe is the
only provider that gives us recurring billing + multi-currency +
dunning + invoicing + tax handling globally. Iraqi providers don't
support recurring (R7.2). So:
- Tenants pay us via **Stripe**.
- Tenants' customers pay tenants via **whatever** (FastPay, Cash, etc).
- Different code paths, no overlap.

Stripe requires a non-Iraqi legal entity. Until that's set up (R7.7),
Stripe is wired but inert. Manual bank transfer + a hand-written
invoice is the fallback (recorded via the manual-payment tool — see
`saas-dunning.md` §4).

---

## 3. Stripe integration

### 3.1 Account architecture

We use a **single Stripe account** (not Stripe Connect) with one
Customer per tenant. Multi-account-per-tenant is overkill for our
size.

Mapping:
```
Stripe Customer  ↔  tenants/{id}.billing.stripe_customer_id
Stripe Subscription  ↔  tenants/{id}.billing.stripe_subscription_id
```

### 3.2 Webhook events we care about

| Event | Action |
|-------|--------|
| `customer.subscription.created` | Mark subscription active, set `next_billing_date` |
| `customer.subscription.updated` | Resync status, plan, period |
| `customer.subscription.deleted` | Mark canceled, set `canceled_at` |
| `invoice.payment_succeeded` | Reset dunning, mark `paid_through` |
| `invoice.payment_failed` | Start dunning at stage 0 |
| `invoice.upcoming` | Send "renewal in 3 days" email (Pro tier) |
| `customer.subscription.trial_will_end` | Trigger trial-ending email at day 75 |

Handler: `backend/app/billing/stripe_webhooks.py`. Each event is
idempotent by `event.id`.

### 3.3 Tax handling

Stripe Tax is **disabled** for IQD pricing — Iraq isn't in Stripe Tax's
coverage. For USD pricing we use Stripe Tax for non-Iraq customers.

Iraqi tenants pay IQD; we collect zero tax through Stripe and reconcile
local VAT via our own books.

---

## 4. Dunning engine

The engine (`backend/app/billing/dunning.py`) advances tenants through
stages defined in [`saas-dunning.md`](../runbooks/saas-dunning.md):
day 0 → 3 → 7 → 14 → 30 → 90 → 120.

### 4.1 State machine

```
   active
     │
     │ invoice.payment_failed (webhook)
     ▼
   past_due (stage 0)
     │
     │ +3 days
     ▼
   past_due (stage 3) ─── invoice.payment_succeeded ──▶ active
     │
     │ +4 days (total 7)
     ▼
   past_due (stage 7)
     │
     │ +7 days (total 14)
     ▼
   read_only (stage 14)
     │
     │ +16 days (total 30)
     ▼
   suspended (stage 30) ─── manual reactivation ──▶ active
     │
     │ +60 days (total 90)
     ▼
   pending_deletion (stage 90)
     │
     │ +30 days (total 120)
     ▼
   terminated
```

### 4.2 The cron

A Cloud Scheduler job runs `python -m backend.app.billing.dunning.advance` at
`02:00 UTC` daily. It:

1. Queries subscriptions where `next_action_at <= now()`.
2. For each, runs the stage handler — which is a pure function:
   `(current_state, current_stage, days_since_last_change) → next_state`.
3. Writes the new state + emits side effects (email, SMS, status change).
4. Records audit log entry.

Stage handlers live in `backend/app/billing/dunning/stages.py`. Each
handler is < 50 lines and unit-tested in isolation.

### 4.3 Pausing

`tenants/{id}.billing.subscription.dunning_paused = true` skips all
advances. See `saas-dunning.md` §2.

### 4.4 Calendar-aware delays

The engine consults `backend/app/data/iq_bank_calendar.yaml` (and
Ramadan / Hijri calendar) to extend timers across multi-day Iraqi
bank holidays (`saas-dunning.md` §7).

---

## 5. Plan changes

### 5.1 Upgrade (Starter → Growth → Pro)

Effective **immediately**. Proration credit applied to the next
invoice.

```python
POST /api/saas-billing/change-plan
{ "tenant_id": "...", "new_plan": "growth" }
```

Backend:
1. Call `stripe.Subscription.modify(sub_id, items=[...], proration_behavior="always_invoice")`.
2. Stripe immediately issues a prorated invoice for the upgrade delta.
3. On `invoice.payment_succeeded` webhook, flip `tenants/{id}.plan = "growth"`.
4. If payment fails, the upgrade rolls back — tenant stays on old plan.

### 5.2 Downgrade

Effective at **end of current billing period**. No refund mid-cycle.

```python
POST /api/saas-billing/change-plan
{ "tenant_id": "...", "new_plan": "starter" }
```

Backend:
1. Call `stripe.Subscription.modify(sub_id, items=[...], proration_behavior="none", billing_cycle_anchor="unchanged")` and schedule the change for period end.
2. UI shows "Downgrade scheduled for YYYY-MM-DD".
3. When period rolls, webhook arrives, plan changes.

### 5.3 Why the asymmetry

Upgrades capture revenue immediately (good for us). Downgrades waiting
until period end avoids the messy "we already collected your money,
now we need to refund part of it" math, which is also a churn vector.
This matches how Atlassian, Linear, and Notion handle it.

---

## 6. Proration

When a customer upgrades mid-period, we owe them credit for the unused
days on the old plan and charge them for the remaining days on the new
plan. Stripe does this automatically via `proration_behavior:
always_invoice`.

For our internal reporting (MRR / ARR), we use straight-line
recognition over the full month, not the prorated cash. So MRR equals
the rate-card value of all active subscriptions on the last day of the
month, regardless of when each one started.

The reporting query lives at
`backend/app/billing/reports.py::compute_mrr`.

---

## 7. Trial enforcement

Free trial: 90 days (ADR-LR-006).

### 7.1 Trial start

When a new tenant signs up, we create a Stripe Subscription with
`trial_period_days: 90` and no payment method. Stripe handles the
trial timer internally.

`tenants/{id}.billing.trial_ends_at` mirrors the Stripe value for fast
local checks.

### 7.2 Trial-end behavior

- If a payment method was added during trial: Stripe charges at day 90.
- If not: Stripe sets status to `past_due`. Our webhook handler moves the
  tenant into the dunning sequence at stage 0.

### 7.3 Trial reminders

Emitted by the dunning cron, looking at `trial_ends_at`:

- Day 75: "15 days left, add payment method"
- Day 83: "7 days left"
- Day 89: "1 day left, trial ends tomorrow"

### 7.4 Manual extension

```bash
python -m backend.app.billing.extend_trial \
  --tenant TENANT_ID --days 30 --reason "..."
```

This calls `stripe.Subscription.modify(trial_end=new_timestamp)` and
updates our mirror. Use for legitimate business reasons (sales
follow-up, holiday delay).

---

## 8. Sequence — new subscription

```
   Tenant admin             Frontend            Backend            Stripe
        │                       │                  │                   │
        │ "Subscribe to Growth" │                  │                   │
        ├──────────────────────▶│                  │                   │
        │                       │ POST /api/saas-billing/subscribe     │
        │                       ├─────────────────▶│                   │
        │                       │                  │ Create Customer   │
        │                       │                  ├──────────────────▶│
        │                       │                  │ Create Subscription
        │                       │                  ├──────────────────▶│
        │                       │                  │ checkout_session_url
        │                       │                  │◀──────────────────┤
        │                       │  302 → Stripe Checkout              │
        │◀──────────────────────┴──────────────────┤                   │
        │                                          │                   │
        │  Stripe-hosted card form                 │                   │
        ├──────────────────────────────────────────────────────────────▶│
        │                                                              │
        │                  webhook customer.subscription.created       │
        │                       ┌──────────────────────────────────────┤
        │                       │                  │                   │
        │                       │                  │ Update tenant doc │
        │                       │                  │                   │
        │  302 → success page   │                  │                   │
        │◀──────────────────────┤                  │                   │
```

---

## 9. Sequence — failed renewal

```
                                                    Stripe
                                                       │
                                                       │ attempts charge
                                                       │ at next_billing_date
                                                       │
                                                       │ card declined
                                                       │
                                webhook invoice.payment_failed
                              ┌────────────────────────┤
                              │                        │
                       Backend                         │
                              │ Subscription → past_due
                              │ dunning_stage → 0      │
                              │ Trigger day-0 email    │
                              │                        │
                              │                        │ Stripe smart retry
                              │                        │ at days 3, 5, 7
                              │                        │
                              │                  webhook invoice.payment_succeeded
                              │◀───────────────────────┤
                              │                        │
                              │ Subscription → active  │
                              │ dunning_stage → 0      │
                              │ Trigger receipt email  │
```

If Stripe smart retries fail through day 7, our dunning cron picks up
and advances stages 14 / 30 / 90 / 120.

---

## 10. Files map

```
backend/app/billing/
├── plans.py                # Plan definitions
├── stripe_client.py        # Stripe SDK wrapper, retry policy
├── stripe_webhooks.py      # Webhook handlers
├── subscriptions.py        # Create / modify / cancel subscriptions
├── dunning/
│   ├── __init__.py
│   ├── advance.py          # The cron entry point
│   ├── stages.py           # Stage handlers
│   ├── pause.py            # Manual pause / resume
│   ├── skip.py             # Skip to stage
│   └── extend_trial.py
├── manual_payment.py       # Record offline payment
├── reports.py              # MRR / churn / ARR
└── locale.py               # Pick KU / EN / AR for templates

backend/app/api/saas_billing/
├── __init__.py
├── subscribe.py            # POST /api/saas-billing/subscribe
├── change_plan.py          # POST /api/saas-billing/change-plan
├── cancel.py               # POST /api/saas-billing/cancel
├── webhooks.py             # POST /api/saas-billing/webhooks/stripe
└── invoices.py             # GET /api/saas-billing/invoices

frontend/src/pages/billing/
├── TenantBilling.tsx       # Tenant view: current plan, invoices, payment method
├── PlanPicker.tsx          # Upgrade / downgrade flow
├── PaymentMethod.tsx       # Wraps Stripe Elements
└── InvoiceList.tsx

frontend/src/pages/admin/billing/   (super-admin)
├── SuperAdminBilling.tsx   # MRR, churn, past_due count
├── TenantBillingDetail.tsx # Per-tenant dunning + manual ops
└── ManualPaymentForm.tsx
```

---

## 11. Configuration

Required env vars:

| Var | Source | Notes |
|-----|--------|-------|
| `STRIPE_API_KEY` | Secret Manager | sk_live_... (prod) or sk_test_... (staging) |
| `STRIPE_WEBHOOK_SECRET` | Secret Manager | whsec_... |
| `STRIPE_PRICE_ID_STARTER_MONTHLY_IQD` | Secret Manager | from bootstrap-stripe.ts |
| `STRIPE_PRICE_ID_STARTER_MONTHLY_USD` | ... | one var per (plan, period, currency) |
| `DUNNING_EMAIL_FROM` | Config | `billing@erp.zoho.kurd.iq` |
| `DUNNING_PHONE_FROM` | Config | `+964-XXX-XXXX` |

---

## 12. Related

- ADR-LR-001 — three-tier pricing
- ADR-LR-002 — IQD without decimals
- ADR-LR-003 — Stripe choice
- ADR-LR-005 — dunning sequence
- ADR-LR-006 — 90-day trial
- [`saas-dunning.md`](../runbooks/saas-dunning.md)
- [`payments-architecture.md`](./payments-architecture.md) — tenant-side

---

*Last reviewed: 2026-05-29 by Safa Othman. Re-review when Stripe entity is finalized (R7.7).*
