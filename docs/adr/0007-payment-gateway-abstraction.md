# ADR-LR-004 — PaymentGateway abstraction (Strategy pattern)

| | |
|---|---|
| **Date** | 2026-05-29 |
| **Authors** | Safa Othman |
| **Reviewers** | Backend lead |
| **Status** | Accepted |
| **Supersedes** | — |
| **Related** | `.kiro/specs/launch-readiness` T-LR.4.1; `docs/dev/payments-architecture.md` §2 |

## 1. Context

Tenant-side payments (the customer pays the tenant, not us paying us)
need to support at least six providers at launch:

* Cash (at POS, no provider)
* Cash on Delivery (courier networks)
* FastPay (Iraqi digital wallet)
* Qi Card (Iraqi card network)
* Zain Cash (Iraqi telco wallet)
* Stripe (international tenants, card payments)

Each provider differs in:

* Authentication mechanism (OAuth 2.0, API key, HMAC-signed body)
* Settlement timing (instant for Cash, T+2 for Stripe, T+1 for FastPay)
* Refund flow (REST, file upload, in-person, none)
* Webhook signature scheme
* Idempotency contract
* Fee structure (per-tx, flat, none)
* Currency support
* Recurring support (most: no)

The naive design — `if provider == "stripe": ... elif provider ==
"cash": ...` — would scatter provider logic across every invoice and
POS endpoint. Adding a seventh provider would mean editing dozens of
files.

We also need to support tenants who enable multiple providers
simultaneously (the common case — every Iraqi shop wants Cash + FastPay
+ Qi all active so the customer can pick).

## 2. Decision

**We will use the Strategy pattern: a `PaymentGateway` abstract base
class with one concrete implementation per provider, registered into a
process-wide registry at startup.**

```python
class PaymentGateway(ABC):
    name: str
    @abstractmethod
    async def charge(self, req: ChargeRequest) -> ChargeResult: ...
    @abstractmethod
    async def refund(self, req: RefundRequest) -> RefundResult: ...
    @abstractmethod
    def verify_webhook(self, headers: dict, body: bytes) -> dict: ...
    @abstractmethod
    def supports_recurring(self) -> bool: ...
```

Endpoints and services interact only with the abstract type:

```python
gateway = registry.get(payment_method.provider)
result = await gateway.charge(ChargeRequest(...))
```

The full interface and lifecycle are documented in
`docs/dev/payments-architecture.md`. The decision here is the
**pattern choice**, not the specific shape.

## 3. Consequences

### Positive

* Adding a provider is six well-defined steps (see payments-architecture.md §3). No core endpoint touches change.
* Each provider's logic lives in one file (`backend/app/payments/providers/<name>.py`) and is independently testable.
* The webhook route auto-dispatches to the registered gateway — no per-provider route file.
* The service layer (`payments/service.py`) is provider-agnostic — all idempotency, GL posting, audit logging happens once.
* Test doubles are trivial: an in-memory `FakeGateway` for unit tests.

### Negative

* Indirection cost — reading the code requires understanding the dispatch. A new dev needs the architecture doc, not just the file.
* The interface has to be the union of needs across providers, so it carries some leaky abstractions (e.g. `return_url` is meaningful only for hosted-page providers).
* Providers that don't fit (e.g. Cash, which has no `verify_webhook`) need to return no-op or raise — slight awkwardness.

### Neutral / known unknowns

* If a future provider needs a fundamentally different shape (e.g. async + polling instead of webhook), we may need a second abstract type. The registry can hold both; the dispatch is by `provider.name`.

## 4. Alternatives considered

### Alternative A — Per-provider SDK calls inline

* **Pros:** Most direct; readable on first encounter.
* **Cons:** Logic for each provider ends up duplicated across the charge, refund, and webhook code paths. Adding a provider means editing many files. Hard to test in isolation.
* **Why rejected:** Scales badly past 2 providers.

### Alternative B — Plugin loading via entry_points

* **Pros:** Providers could ship as pip packages.
* **Cons:** Overkill at our scale; we don't have third-party provider contributors. Hides what's installed from a `grep` of the codebase.
* **Why rejected:** Premature.

### Alternative C — Factory function returning a dict of callables

* **Pros:** Avoids the OOP weight.
* **Cons:** Loses the type discipline of an ABC; harder to enforce that every provider implements `verify_webhook`. IDE tooling worse.
* **Why rejected:** ABC gives us static guarantees the factory pattern doesn't.

### Alternative D — Event-sourced (treat every provider as just events; we apply them generically)

* **Pros:** Maximum decoupling.
* **Cons:** Requires every provider to emit events in our canonical shape — that's a translator per provider, which is exactly what the strategy pattern does, just with extra steps.
* **Why rejected:** Doesn't save us work.

## 5. Validation

We will know we made the right call if:

* Adding the next provider after the initial six takes < 3 days of dev work end-to-end (including tests).
* The diff for adding a provider touches only `payments/providers/<name>.py`, `payments/__init__.py`, `payments/catalog.py`, `secrets.tf`, `frontend/.../Providers.tsx`, and the new tests.
* Zero "I had to edit invoice flow to add Provider X" incidents.

Revisit if:

* A provider's needs are so structurally different that the abstraction becomes a hindrance.
* We end up needing more than ~ 10 fields on `ChargeRequest` to satisfy provider-specific quirks (a sign the abstraction is leaking).

## 6. Notes

* The Strategy pattern is textbook here — see GoF. We use the modern Python form (`ABC` + `@abstractmethod`).
* The webhook auto-routing relies on every provider having a unique `name` — enforced by the registry on registration.
* The `supports_recurring()` capability check is the seam where the SaaS billing engine decides whether a provider can drive subscriptions. Today only Stripe returns True.

---

*Last reviewed: 2026-05-29 by Safa Othman. Next review: after adding the 7th provider.*
