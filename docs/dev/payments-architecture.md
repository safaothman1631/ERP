# Developer Guide — Payments Architecture (Tenant-Side)

> **Spec ref:** `.kiro/specs/launch-readiness` Phase R4
> **Audience:** Backend devs working on payment providers
> **Scope:** Payments that tenants collect FROM their customers (not SaaS billing — that's in [`billing-architecture.md`](./billing-architecture.md)).

This doc explains:
- The `PaymentGateway` abstraction
- How to add a new provider
- The webhook contract
- The `Payment` aggregate lifecycle
- The refund flow
- Sequence diagrams for the main flows

---

## 1. Why an abstraction

Iraqi tenants take payment via:
- **Cash** (in shop, on delivery)
- **COD** via courier networks (Aramex, local couriers)
- **FastPay**, **Qi Card**, **Zain Cash**, **Asia Pay** (local digital wallets)
- **Stripe** (for tenants with international customers)

These differ in everything: authentication (OAuth, API key, HMAC),
settlement timing (instant to T+5), refund APIs (REST vs SOAP vs file
upload), idempotency contract, webhook signature scheme, fee structure.

If we hard-coded each one into the invoice flow, adding the seventh
provider would require touching every invoice endpoint. The
`PaymentGateway` interface (ADR-LR-004) gives every provider one shape
to fulfill so the rest of the system stays provider-agnostic.

---

## 2. The interface

```python
# backend/app/payments/gateway.py

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal, Optional

PaymentStatus = Literal[
    "pending", "authorized", "paid", "failed",
    "refunded", "partially_refunded", "disputed"
]

@dataclass
class ChargeRequest:
    tenant_id: str
    invoice_id: str
    amount_minor: int           # 250000 IQD == 250,000 (IQD has no decimals)
    currency: Literal["IQD", "USD"]
    customer: dict              # name, phone, email (provider-specific subset)
    return_url: Optional[str]   # for hosted page redirects
    idempotency_key: str

@dataclass
class ChargeResult:
    provider_payment_id: str
    status: PaymentStatus
    redirect_url: Optional[str] = None   # if user must complete elsewhere
    raw_response: dict = None            # for debugging only

@dataclass
class RefundRequest:
    tenant_id: str
    provider_payment_id: str
    amount_minor: int
    reason: str

@dataclass
class RefundResult:
    provider_refund_id: str
    status: Literal["pending", "succeeded", "failed"]

class PaymentGateway(ABC):
    name: str   # e.g. "stripe", "cash", "fastpay"

    @abstractmethod
    async def charge(self, req: ChargeRequest) -> ChargeResult: ...

    @abstractmethod
    async def refund(self, req: RefundRequest) -> RefundResult: ...

    @abstractmethod
    def verify_webhook(self, headers: dict, body: bytes) -> dict:
        """Verify signature, return parsed event. Raises on failure."""
        ...

    @abstractmethod
    def supports_recurring(self) -> bool: ...
```

Providers register themselves in
`backend/app/payments/registry.py`:

```python
REGISTRY: dict[str, PaymentGateway] = {}

def register(gateway: PaymentGateway) -> None:
    REGISTRY[gateway.name] = gateway

def get(name: str) -> PaymentGateway:
    return REGISTRY[name]
```

---

## 3. Adding a new provider

Six steps:

### 3.1 Create the adapter file

`backend/app/payments/providers/<provider>.py`:

```python
from ..gateway import PaymentGateway, ChargeRequest, ChargeResult, ...

class FooGateway(PaymentGateway):
    name = "foo"

    def __init__(self, api_key: str, webhook_secret: str):
        self.api_key = api_key
        self.webhook_secret = webhook_secret

    async def charge(self, req: ChargeRequest) -> ChargeResult:
        # 1. Map our request to provider's API shape
        # 2. Call provider (httpx with timeouts)
        # 3. Map response to ChargeResult
        # 4. Raise PaymentGatewayError on failures
        ...

    async def refund(self, req: RefundRequest) -> RefundResult:
        ...

    def verify_webhook(self, headers, body) -> dict:
        # Verify HMAC / signature
        # Parse body as JSON
        # Return event dict with at least:
        #   { "type": "...", "provider_payment_id": "...", ... }
        ...

    def supports_recurring(self) -> bool:
        return False
```

### 3.2 Register in the bootstrap

`backend/app/payments/__init__.py`:

```python
from .providers.foo import FooGateway
from . import registry

def init_gateways(config):
    if config.foo_enabled:
        registry.register(FooGateway(
            api_key=config.foo_api_key,
            webhook_secret=config.foo_webhook_secret,
        ))
```

### 3.3 Add the webhook route alias

`backend/app/api/payments/webhooks.py` auto-routes to
`/api/payments/webhooks/<provider>` for any registered provider — no
extra wiring needed. The handler:

```python
@router.post("/api/payments/webhooks/{provider}")
async def handle_webhook(provider: str, request: Request):
    gateway = registry.get(provider)
    event = gateway.verify_webhook(dict(request.headers), await request.body())
    await payments_service.apply_event(provider, event)
    return Response(status_code=200)
```

### 3.4 Define the secret in Secret Manager

Two secrets per provider:
- `PROD_<PROVIDER>_API_KEY`
- `PROD_<PROVIDER>_WEBHOOK_SECRET`

Plus the staging variants. Add to `terraform/secrets.tf`.

### 3.5 Add the provider toggle to the tenant settings UI

`frontend/src/pages/settings/payments/Providers.tsx` reads the
provider catalog from `/api/payments/providers` and renders a card for
each. Add the new provider to the backend catalog:

```python
# backend/app/payments/catalog.py
PROVIDERS = [
    ...
    {"name": "foo", "display": "Foo Pay", "regions": ["IQ"], "fee_pct": 1.5},
]
```

### 3.6 Write the tests

Tests live in `backend/tests/payments/test_<provider>.py`. Cover:

- Happy-path charge
- Refund flow
- Webhook signature verify happy + fail
- Webhook idempotent replay
- Currency / amount edge cases (IQD no-decimals — see ADR-LR-002)

---

## 4. Webhook contract

Every provider must produce events with at minimum these fields after
`verify_webhook`:

```python
{
  "type": str,                       # "payment.succeeded" | "payment.failed" | "refund.succeeded" | ...
  "provider_payment_id": str,        # provider's id for the payment
  "provider_refund_id": Optional[str],
  "amount_minor": int,
  "currency": str,
  "occurred_at": datetime,           # provider's timestamp
  "raw": dict,                       # original payload (for audit)
}
```

The service layer (`backend/app/payments/service.py::apply_event`)
takes the normalized event and updates the `Payment` aggregate. It is
**idempotent** — re-applying the same event by `provider_payment_id +
type` is a no-op. Providers that send duplicate webhooks just work.

### 4.1 Signature schemes (current)

| Provider | Scheme | Header |
|----------|--------|--------|
| Stripe | HMAC-SHA256 over timestamp + body | `Stripe-Signature` |
| Cash | None (no webhook) | — |
| COD | HMAC-SHA256, our own scheme | `X-COD-Signature` |
| FastPay | TBD | TBD |
| Qi | TBD | TBD |
| Zain | TBD | TBD |

Our policy: **reject any unsigned webhook** with 401. No exceptions.

---

## 5. Payment lifecycle

```
                  charge()                  webhook
   [no record] ─────────────▶ [pending] ──────────▶ [paid]
                                  │                    │
                                  │ webhook            │ refund()
                                  ▼                    ▼
                              [failed]           [refunded /
                                                  partially_refunded]
                                                       │
                                                       │ webhook
                                                       ▼
                                                  [disputed]
```

### 5.1 The `Payment` Firestore doc

```
tenants/{tenant_id}/payments/{payment_id}
  ├── id: string (uuid)
  ├── invoice_id: string
  ├── provider: string
  ├── provider_payment_id: string         # provider's id
  ├── amount_minor: int
  ├── currency: "IQD" | "USD"
  ├── status: PaymentStatus
  ├── created_at: timestamp
  ├── paid_at: timestamp | null
  ├── refunded_amount_minor: int
  ├── created_via: "checkout" | "pos" | "webhook" | "admin_manual"
  ├── idempotency_key: string
  └── events: [{ type, at, raw }]         # audit trail (last 20 events)
```

Indices:
- `(tenant_id, invoice_id)` for "show all payments for this invoice"
- `(tenant_id, provider, status)` for recon
- `(tenant_id, paid_at)` for reports
- `(provider, provider_payment_id)` unique — guards webhook idempotency

### 5.2 GL posting

Every `Payment` transition writes a journal entry via
`backend/app/services/journal.py`. The mapping:

| Transition | Debit | Credit |
|------------|-------|--------|
| `pending → paid` | Cash/Bank Asset (per provider) | A/R (or Sales if no invoice) |
| `paid → refunded` | A/R (or Sales Returns) | Cash/Bank Asset |
| `paid → disputed` | Bad Debt | Cash/Bank Asset |

The journal entry uses the tenant's COA — codes are resolved via
`tenants/{id}/accounts` lookups by canonical name.

---

## 6. Refund flow (sequence)

```
   Tenant admin                  Frontend                  Backend                  Provider
        │                            │                         │                        │
        │ click "Refund"             │                         │                        │
        ├───────────────────────────▶│                         │                        │
        │                            │ POST /api/payments/{id}/refund                   │
        │                            ├────────────────────────▶│                        │
        │                            │                         │ gateway.refund(...)    │
        │                            │                         ├───────────────────────▶│
        │                            │                         │                        │
        │                            │                         │    RefundResult        │
        │                            │                         │◀───────────────────────┤
        │                            │                         │                        │
        │                            │                         │ Mark Payment refund_pending
        │                            │                         │ Write audit log        │
        │                            │   200 { refund_id }     │                        │
        │                            │◀────────────────────────┤                        │
        │   Toast "Refund pending"   │                         │                        │
        │◀───────────────────────────┤                         │                        │
        │                            │                         │                        │
        │                            │                         │ ◀──── webhook ────────┤
        │                            │                         │ verify, apply_event    │
        │                            │                         │ Payment → refunded     │
        │                            │                         │ Post journal entry     │
        │                            │                         │                        │
        │  (push to tenant)          │                         │                        │
        │◀──────"Refund completed"───┴─────────────────────────┤                        │
```

Why two phases (refund_pending → refunded): providers like Stripe
return 200 from the refund call but only finalize via webhook. We
display "pending" to the user until the webhook confirms.

For Cash refunds, there's no provider call — we mark the Payment
refunded synchronously and post the journal immediately.

---

## 7. Charge flow — POS cash sale (synchronous)

```
   Cashier             POSCart UI            Backend          Firestore
      │                     │                    │                 │
      │ "Pay 250,000 IQD cash"                   │                 │
      ├────────────────────▶│                    │                 │
      │                     │ POST /api/pos/orders/{id}/pay        │
      │                     │ { method: "cash", tendered: 250000 } │
      │                     ├───────────────────▶│                 │
      │                     │                    │ CashGateway.charge()
      │                     │                    │   (no provider call;
      │                     │                    │    returns ChargeResult immediately)
      │                     │                    ├────────────────▶│
      │                     │                    │ write Payment   │
      │                     │                    │ write Journal   │
      │                     │   200 { payment }  │                 │
      │                     │◀───────────────────┤                 │
      │  Receipt printed    │                    │                 │
      │◀────────────────────┤                    │                 │
```

For Stripe / FastPay / Qi (hosted page flow), the second step returns
a `redirect_url` and the customer completes on the provider's UI.

---

## 8. Hosted payment link

For invoices sent to customers (not in-store), we generate a signed
URL:

```
POST /api/invoices/{id}/pay-link
→ { url: "https://pay.erp.zoho.kurd.iq/...?t=<jwt>" }
```

The JWT (ADR-LR-010) carries:
- `tenant_id`, `invoice_id`, `amount_minor`, `currency`
- `exp` — short-lived (24h by default; tenant-configurable)
- Signature with `PAY_LINK_SIGNING_KEY` (rotated quarterly)

The pay page is a minimal route that resolves the JWT, fetches the
invoice (no auth required because the JWT proves intent), shows the
tenant's enabled providers, and calls the same `/api/payments/charge`
endpoint with `created_via: "pay_link"`.

---

## 9. Idempotency

Every charge request carries an `Idempotency-Key` header. Backend
middleware (`backend/app/middleware/idempotency_http.py`) caches the
response for 24 hours keyed by `(tenant_id, route, idempotency_key)`.

For provider-side idempotency, each gateway adapter forwards a key to
the provider where supported (Stripe: `Idempotency-Key`; FastPay: TBD).

The combination protects against:
- Network retries from our frontend
- Browser back-button replays
- Provider duplicate webhooks

---

## 10. Files map

```
backend/app/payments/
├── gateway.py              # Abstract interface
├── registry.py             # Provider registry
├── service.py              # Orchestration (charge, refund, apply_event)
├── catalog.py              # Provider metadata (display, regions, fees)
├── recon/                  # Reconciliation (nightly job)
│   ├── nightly.py
│   ├── manual_close.py
│   └── detail.py
└── providers/
    ├── cash.py
    ├── cod.py
    ├── stripe.py
    ├── fastpay.py          # PENDING
    ├── qi.py               # PENDING
    └── zain.py             # PENDING

backend/app/api/
├── payments/
│   ├── __init__.py         # Mount routes
│   ├── charges.py          # POST /api/payments/charge
│   ├── refunds.py          # POST /api/payments/{id}/refund
│   ├── pay_link.py         # POST /api/invoices/{id}/pay-link
│   └── webhooks.py         # POST /api/payments/webhooks/{provider}

backend/app/firestore/
└── payments_repo.py        # Firestore repo for Payment aggregate

frontend/src/pages/
├── settings/payments/
│   ├── Providers.tsx
│   └── Reconciliation.tsx
└── pos/
    └── POSPaymentMethodPicker.tsx
```

---

## 11. Related

- ADR-LR-004 — PaymentGateway abstraction
- ADR-LR-002 — IQD without decimals
- ADR-LR-010 — Hosted pay link signed JWT
- [`payment-reconciliation.md`](../runbooks/payment-reconciliation.md)
- [`billing-architecture.md`](./billing-architecture.md) — SaaS side

---

*Last reviewed: 2026-05-29 by Safa Othman. Re-review when FastPay / Qi / Zain land.*
