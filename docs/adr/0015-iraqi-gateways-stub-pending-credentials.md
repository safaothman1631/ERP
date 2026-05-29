# ADR-LR-011 — Ship Iraqi payment gateways as registered-but-stubbed adapters

| | |
|---|---|
| **Date** | 2026-05-29 |
| **Authors** | Safa Othman |
| **Reviewers** | Backend lead, Payments |
| **Status** | Accepted |
| **Supersedes** | — |
| **Related** | ADR-LR-004 (PaymentGateway abstraction, `docs/adr/0007-payment-gateway-abstraction.md`); ADR-LR-010 (hosted pay-link); `.kiro/specs/launch-readiness` §R4, §R7.2–R7.5; `backend/app/payments/`; `docs/handbook/engineering-handbook.md` §8.1 |

## 1. Context

`PaymentGateway` (ADR-LR-004) is the Strategy interface every payment provider
implements: `initiate`, `capture`, `refund`, `verify_webhook`, plus a status
fetch. We ship seven adapters (`backend/app/payments/`):

| Adapter | State | Why |
|---|---|---|
| `cash` | **Complete** | No external dependency; idempotent immediate-succeeded. |
| `cod` (cash on delivery) | **Complete** | Pure state machine; no external API. |
| `stripe` | **Complete** | SaaS billing already integrates Stripe (ADR-LR-003); HMAC webhook verify + BalanceTransaction settlement. |
| `fastpay` | **Stub** | Needs FastPay merchant credentials (R7.2). |
| `qi` (Qi Card) | **Stub** | Needs Qi credentials (R7.3). |
| `zain_cash` | **Stub** | Needs Zain Cash credentials (R7.4). |
| `asia_pay` | **Stub** | Needs Asia Pay credentials (R7.5). |

The four Iraqi gateways cannot be finished today: each requires a **merchant
account, API credentials, and sandbox access** that only exist after a
commercial onboarding with the provider (an external blocker, R7.2–R7.5). The
interfaces, request/response shapes, and webhook-verification *plans* are
known; the live integration is not.

The question this ADR settles: **what do we ship for a provider we can't yet
finish?** Three obvious options — omit it entirely, register it as a silent
no-op, or register it but make every call fail loudly.

A wrong choice here is a money bug. A gateway that *silently* succeeds without
actually charging is the worst outcome in the system.

## 2. Decision

**We register all seven adapters at startup, but each unfinished Iraqi gateway
implements the full `PaymentGateway` interface with every method raising
`PaymentProviderNotConfigured` (a subclass of `NotImplementedError`) carrying a
message that names the closing ticket — e.g. `"FastPay credentials pending —
see R7.2"`.**

```python
# backend/app/payments/fastpay_gateway.py
_BLOCKED = "FastPay credentials pending — see R7.2 (...)"

class FastPayGateway(PaymentGateway):
    slug = "fastpay"

    async def initiate(self, amount, order):
        # TODO(R7.2): POST /oauth/token, then POST /payments; persist QR.
        raise NotImplementedError(_BLOCKED)
    # capture / refund / verify_webhook / fetch_status — all the same, each
    # annotated with the exact API call R7.2 must implement.
```

`register_default_providers()` (`bootstrap.py`, called from `main.py` startup)
registers **all seven** — the registry advertises the full provider catalogue
so the Settings → Payments UI can render every tile, and an operator can see at
a glance which providers exist. Attempting to actually transact through an
unprovisioned provider fails with a clear, ticketed error instead of a 500 with
a stack trace or, far worse, a fake success.

When credentials arrive, closing the work is mechanical: fill in the five
method bodies in one `*_gateway.py` file against the documented TODOs. No
wiring, no registry, no UI change.

## 3. Consequences

### Positive

* **No silent-success money bug is possible.** An unprovisioned gateway can
  never report a charge it didn't make.
* The provider catalogue is complete and honest from day one; the UI doesn't
  need feature flags per provider.
* The remaining work is localised to a single file per provider, with the exact
  API calls pre-documented as TODOs.
* Each error message is **self-routing**: the `see R7.x` text points the
  operator (or a future engineer) straight at the closing ticket.

### Negative

* A tenant who enables, say, FastPay in Settings will get a hard error at
  transact time. We mitigate by surfacing provider readiness in the Settings →
  Payments tile (a stubbed provider renders as "coming soon", not "ready").
* "Registered but non-functional" is a state someone could misread as a bug if
  they don't know the convention — addressed by this ADR and the handbook §8.1.

### Neutral / known unknowns

* The exact webhook signature scheme per Iraqi provider (HMAC variant, header
  names) is assumed from typical patterns and marked TODO; it must be confirmed
  against each provider's real docs at R7.x.

## 4. Alternatives considered

### Alternative A — Don't register unfinished gateways at all

* **Pros:** the registry only contains working providers; no "broken" tiles.
* **Cons:** the UI can't show the roadmap; enabling a provider later becomes a
  wiring change in `bootstrap.py` (a shared file) rather than filling one file;
  harder to write a test that asserts "all seven are catalogued".
* **Why rejected:** we want the catalogue complete and the finish-work
  localised.

### Alternative B — Register as a silent no-op (return a pending/succeeded stub)

* **Pros:** no exceptions; demos look smooth.
* **Cons:** **catastrophic** — a no-op that returns success looks like a paid
  invoice. This is the single worst failure mode for a payments system.
* **Why rejected:** safety. A loud failure is infinitely better than a quiet
  false success when money is involved.

### Alternative C — A single "ManualGateway" placeholder for all four

* **Pros:** one stub instead of four.
* **Cons:** loses the per-provider slug, the per-provider TODO map, and the
  per-provider readiness state; the eventual real implementations diverge
  anyway.
* **Why rejected:** the four providers have genuinely different APIs; collapsing
  them now just means splitting them later.

## 5. Validation

We will know we made the right call if:

* `register_default_providers()` registers exactly seven providers at startup
  (logged: "payment providers registered: cash, cod, stripe, fastpay, qi, zain,
  asia_pay").
* `backend/tests/test_payments_*.py` cover cash/cod/stripe happy paths, and a
  test asserts that an unprovisioned gateway raises `PaymentProviderNotConfigured`
  (never returns a success).
* When the first set of Iraqi credentials lands, the diff to go live is a single
  `*_gateway.py` file — no change to `main.py`, the registry, or the UI.

Revisit if: a provider's onboarding reveals the interface can't be satisfied by
the current `PaymentGateway` protocol (then ADR-LR-004 changes, and this follows).

## 6. Notes

* RBAC: POS refunds require `pos.refund` (`services/permissions.py`); a plain
  `pos_cashier` cannot refund. See handbook §8.1.
* Idempotency: `/api/payments/` is an idempotency prefix
  (`middleware/idempotency_http.py`) so a retried charge/refund with the same
  key returns the original result.
* Nightly `payments_reconciliation_nightly` (`scheduler.py`) cross-checks
  provider settlements against our `Payment` records and surfaces mismatches in
  Settings → Payments → Reconciliation.

---

*Last reviewed: 2026-05-29 by Safa Othman. Next review: when the first Iraqi gateway (R7.2 FastPay) is provisioned.*
