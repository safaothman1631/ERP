# R5 — SaaS Subscription Billing (Code Scaffold)

**Owner:** SaaS Billing Specialist subagent
**Date:** 2026-05-29
**Spec:** `.kiro/specs/launch-readiness/` (design §5.10–5.13, tasks §R5)
**Status:** Code scaffold complete. Stripe live-key bootstrap blocked on R7.7
(legal-entity formation). Frontend and backend compile-independent; integration
into `main.py` and routing is deferred to the integration step.

---

## Files created

### Backend — billing core

| File | Purpose |
|------|---------|
| `backend/app/billing/__init__.py` | Package init; re-exports `PLANS`, `get_plan`, `list_plans`. |
| `backend/app/billing/plans.py` | Plan catalogue. Three plans (starter / growth / pro), IQD + USD prices, monthly + annual, limits + features. Pure dataclasses, no runtime side effects. |
| `backend/app/billing/stripe.py` | Stripe Subscriptions adapter. **Lazy imports** the SDK; raises `StripeNotConfigured` if `STRIPE_SECRET_KEY` absent so boot is resilient. Exposes `create_customer`, `create_subscription`, `update_subscription_plan` (with proration), `preview_proration`, `cancel_subscription`, `reactivate_subscription`, `list_invoices`, `create_billing_portal_session`, `verify_webhook`, `load_price_map`, `derive_amount_for_plan`. |
| `backend/app/billing/fastpay_recurring.py` | Iraqi recurring rail (Stripe-not-available fallback). `BillingPeriod` dataclass + pure state-machine transitions (`issued → reminded → paid` or `→ past_due → suspended`). 7-day grace before past_due, 7 more before suspension. |
| `backend/app/billing/dunning.py` | Day-counted dunning sequence (0/3/7/14/30/60). `DunningContext` + `next_action`/`record_action`/`stop_sequence`. Pure — scheduler/Cron is the side-effecting layer. |
| `backend/app/billing/trial.py` | Trial countdown. 90-day default. `compute_trial_end`, `days_left`, `banner_state` (info/amber/red), `trial_expiry_action`. |

### Backend — repository

| File | Purpose |
|------|---------|
| `backend/app/firestore/tenant_billing_repo.py` | `TenantBillingRepository` at `tenants/{tid}/billing/state` with `initialize_for_trial`, `update`, `record_payment`, `cancel`, `attach_stripe_ids`. `SaasBillingAdminRepository.iter_states` walks the `billing` collection-group for the admin dashboard. |

### Backend — schemas

| File | Purpose |
|------|---------|
| `backend/app/schemas/saas_billing.py` | Pydantic request/response models: `BillingStateResponse`, `ChangePlanRequest`/`ChangePlanResponse`, `ProrationPreview`, `CancelRequest`/`CancelResponse`, `RestartRequest`, `InvoiceListResponse`, `AdminDashboardResponse`, `AdminTenantListResponse`, `ManualPaymentRequest`/`ManualPaymentResponse`. |

### Backend — API

| File | Purpose |
|------|---------|
| `backend/app/api/saas_billing.py` | Tenant-facing router. `GET /api/saas-billing/plans` (public, also used by marketing page), `GET /state`, `POST /change-plan`, `POST /cancel`, `POST /restart`, `GET /invoices`, `POST /webhooks/stripe`. Permissions: `settings.billing` for mutating routes. Stripe failures are tolerated — state still persists even when Stripe key is missing. |
| `backend/app/api/saas_admin.py` | Super-admin router. `GET /admin/dashboard` (MRR/ARR/churn), `GET /admin/tenants` (paginated, sortable by MRR), `POST /admin/tenants/{tid}/manual-payment` (Iraqi/cash flows). Access gated by `_require_platform_admin`. Exports `ALL_ROUTERS = [router]` for `main.py` to wire up. |

### Backend — permissions

| File | Change |
|------|--------|
| `backend/app/services/permissions.py` | Added `saas_billing.read` and `saas_billing.write` codes. `settings.billing` (already existed) is the code attached to the `change-plan`/`cancel`/`restart` routes. |

### Backend — tests (6 files, ~55 tests)

| File | Coverage |
|------|----------|
| `backend/tests/billing/test_billing_plans.py` (12) | Catalogue contents, IQD passthrough, USD→cents conversion, lookup keys, unknown plans raise. |
| `backend/tests/billing/test_billing_stripe.py` (9) | Lazy SDK init, customer/subscription creation, proration plan-change, cancel-at-period-end vs immediate, webhook verification env-var guard, amount derivation. Uses MagicMock — no real Stripe calls. |
| `backend/tests/billing/test_dunning.py` (10) | Sequence transitions at days 3/7/14/30, stop-sequence halts future actions, service-impact tiers (none → read_only → billing_only), countdown helper. |
| `backend/tests/billing/test_trial.py` (10) | 90-day default, severity ramp info→amber→red, dismiss-then-reshow after 24h, expiry triggers `start_dunning_day_0`. |
| `backend/tests/billing/test_saas_admin.py` (7) | Dashboard count/MRR sums, 403 for non-admin, paginated tenant list sorted by MRR, status_filter, manual-payment marks active, 404 when no state. |
| `backend/tests/billing/test_saas_billing_api.py` (9) | Public plans endpoint, state lazy-init, change-plan preview vs confirm, unknown plan 400, cancel persists, webhook bad-signature 400, unsupported-event ignored. |
| `backend/tests/billing/test_fastpay_recurring.py` (10) | Issue with starter IQD price, reminder promotes state, mark_paid rejects double-pay, past_due/suspended timing, void rejects paid, `tick` idempotency, invoice payload includes amount + URL. |

### Frontend

| File | Purpose |
|------|---------|
| `frontend/src/pages/billing/TenantBilling.tsx` | Tenant billing page — current plan card, trial/past_due/suspended banners, usage bars (`UsageBar` sub-component), invoice history table, opens `PlanPicker`, has cancel modal with reason input. |
| `frontend/src/pages/billing/PlanPicker.tsx` | Modal/flow: currency toggle, cycle toggle (annual shows `-17%` badge), 3 plan cards with selection highlight, proration preview step before confirm. Uses `POST /api/saas-billing/change-plan` with `confirm:false` then `confirm:true`. |
| `frontend/src/pages/admin/SaasBillingDashboard.tsx` | Super-admin: MRR/ARR (IQD + USD), churn %, status counts, paginated tenant table sortable by MRR. Handles 403 with an `Alert`. |
| `frontend/src/pages/pricing/Pricing.tsx` | Public marketing page. SEO + OG meta set imperatively (no react-helmet). IQD/USD + Monthly/Annual toggles. CTA links to `/signup?plan=…`. FAQ accordion driven by i18n keys. **Mark as public in routing** — must not require auth. |
| `frontend/src/components/billing/TrialBanner.tsx` | App-shell banner. Polls `/api/saas-billing/state` every 5 minutes. Severity info/amber/red based on days_left. Dismiss persists 24h via `localStorage`. Hidden when not trialing. Mount above side-nav in the authenticated layout. |

### Bootstrap script

| File | Purpose |
|------|---------|
| `scripts/bootstrap-stripe.ts` | Idempotent Node CLI. Reads plans (mirrored verbatim from `plans.py`), creates one Stripe Product per plan and four Prices per plan (IQD/USD × monthly/annual). Uses `lookup_key` for dedup. Writes `audit/stripe-prices.json` which `stripe.load_price_map()` reads at runtime. Lazy-imports `stripe` so `--help` works without the dep. |

---

## Stripe deps documented

The Stripe SDK is **not added to `requirements.txt`** in this delta — per
constraints (file is off-limits). The lazy-import pattern in `app/billing/stripe.py`
means everything boots cleanly without it. **When R7.7 is unblocked**:

1. `pip install stripe>=10.0.0` → add to `backend/requirements.txt`.
2. `npm i -D stripe` in repo root (for the bootstrap script).
3. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Secret Manager.
4. Run `npx tsx scripts/bootstrap-stripe.ts` → produces `audit/stripe-prices.json`.

---

## Plan structure

| Plan | Slug | IQD/mo | USD/mo | IQD/yr | USD/yr | Users | Inv/mo | POS | Key features |
|------|------|--------|--------|--------|--------|-------|--------|-----|--------------|
| Starter | `starter` | 30,000 | $25 | 300,000 | $250 | 3 | 100 | 1 | — |
| Growth | `growth` | 80,000 | $60 | 800,000 | $600 | 10 | 1,000 | 5 | multi-currency, API, custom reports, advanced inventory |
| Pro | `pro` | 200,000 | $150 | 2,000,000 | $1,500 | 50 | ∞ | ∞ | + priority support, SSO |

Annual = 10× monthly (≈17% discount, marketed as "2 months free").
Default trial: **90 days**.

---

## Integration TODOs

The constraints forbid touching `main.py` and `requirements.txt`. The
integration step (separate task) must:

1. **`backend/app/main.py`**: register routers:
   ```python
   from app.api import saas_billing as saas_billing_api
   from app.api import saas_admin as saas_admin_api
   app.include_router(saas_billing_api.router)
   for r in saas_admin_api.ALL_ROUTERS:
       app.include_router(r)
   ```
2. **`backend/requirements.txt`**: add `stripe>=10.0.0` (once R7.7 unblocked).
3. **`backend/app/middleware/idempotency_http.py`**: add `/api/saas-billing`
   prefix to the idempotency + rate-limit prefix list.
4. **Tenant signup flow** (`backend/app/api/auth.py` or equivalent): after
   creating the tenant org, call
   `TenantBillingRepository(tid).initialize_for_trial(plan_slug="starter")`.
5. **Scheduled job**: a daily cron must:
   - For each tenant: load TenantBilling state.
   - If `status == "trialing"` and trial expired → trigger dunning day-0
     (`trial.trial_expiry_action`).
   - Run `dunning.next_action` + `record_action` for any tenant past day-N.
   - For Iraqi tenants: tick `fastpay_recurring.tick` on each BillingPeriod.
6. **Routing — `frontend/src/App.tsx` / router**:
   - `/settings/billing` → `TenantBilling.tsx` (authenticated).
   - `/admin/billing` → `SaasBillingDashboard.tsx` (super_admin only).
   - `/pricing` → `Pricing.tsx` (**public — must not require auth**).
   - Mount `<TrialBanner />` in the authenticated layout near the top.
7. **Webhook URL** in Stripe dashboard: `https://erp.zoho.kurd.iq/api/saas-billing/webhooks/stripe`.
8. **i18n keys** to add to `locales/{ku,ar,en}.json`: `billing.*`, `pricing.*`,
   `admin.billing.*` (all string literals are wrapped with `t(..., 'fallback')`
   so the page is usable without translation; the i18n splitter job picks them up).
9. **Quick-create permission codes**: `saas_billing.read` / `.write` are
   defined but not yet assigned to roles. Assign to `admin` role in
   `seed/roles.py` (or equivalent).

---

## Open questions

### R7.7 — Legal entity for Stripe (BLOCKER)

Stripe does not operate in Iraq for direct sole proprietorships. Possible paths:
- Form a US Delaware C-corp via **Stripe Atlas** (~$500, 1–2 weeks).
- Form a UK Ltd via Companies House (~£12, 1–3 days, then 4–6 weeks for Stripe approval).
- Use a partner-of-record / Merchant of Record (e.g. Paddle, Lemon Squeezy) —
  trades platform fees for zero legal setup.

**Recommendation**: Until Safa picks, **all international tenants are blocked
from paying**. Launch with Iraqi-only customers via the FastPay rail (R5.3,
implemented) and treat the rest as "waitlist". The code scaffold here is
forward-compatible with any of the three options — only the Stripe key and
the entity name change.

### MoR vs direct Stripe — recurring rail for Iraqi tenants

This delta ships **invoice + manual mark-paid** for Iraqi tenants. If FastPay
business eventually supports recurring (currently uncertain), the Iraqi rail
can be upgraded to auto-charge by extending `fastpay_recurring.py` with an
adapter method. The state machine is forward-compatible.

### USD→IQD FX for the MRR rollup

`saas_admin._mrr_value_iqd` uses a hardcoded `1500 IQD/USD` constant for
ARR/MRR aggregation. **TODO**: source from `app/firestore/currency_rates.py`
(already exists) once the integration step wires it in.

---

## Confidence

**High** for:
- Plan catalogue (single source of truth, mirrored in bootstrap script).
- State machine purity (dunning, fastpay_recurring, trial — all time-pure,
  testable, deterministic).
- Stripe adapter isolation (lazy import, every call wrapped in
  `_wrap_errors`, no SDK at module load).
- Backend endpoint surface matches `requirements.md` §R5.B.
- Test coverage of business rules (55 tests across 6 files).

**Medium** for:
- Stripe webhook → TenantBilling state mapping. I covered the four key events
  but real-world Stripe sends edge events (e.g. `invoice.finalized` without
  payment) that may need additional handling once we have a real account.
- Pricing page i18n — keys are declared with English fallbacks; Kurdish and
  Arabic translations need T-LR.6.1/6.2 to populate.

**Low / requires post-integration verification**:
- Frontend routing wiring (App.tsx) — not touched per constraints.
- Tenant signup hook (`initialize_for_trial`) — left as integration TODO.
- The MRR FX rate placeholder.
- Bootstrap script end-to-end run — blocked on R7.7; will need a live Stripe
  test-mode account to verify idempotency.

**Time spent:** ~70 minutes (within the 75-minute budget).
