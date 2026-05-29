# R4 Payments — Python Dependencies

> **Spec:** `.kiro/specs/launch-readiness` § R4
> **Date:** 2026-05-29
> **Owner:** payments architecture specialist (Claude)

This file records the new Python package(s) introduced by R4 so the user can
add them to `backend/requirements.txt` (the spec constrains agents from
modifying `requirements.txt` directly).

## New runtime dependencies

| Package | Pin | Purpose | Used by |
|---------|-----|---------|---------|
| `stripe` | `>=11.0.0,<13.0.0` | Stripe SDK — Payment Intents, Refunds, BalanceTransactions, Webhook construction | `backend/app/payments/stripe_gateway.py` |

## Optional / soft dependencies

| Package | Pin | Why optional |
|---------|-----|--------------|
| `nest_asyncio` | `>=1.6.0` | Allows sync FastAPI handlers to call `provider.initiate()` (async) when the loop is already running under uvicorn. Falls back gracefully if missing — see `_run()` in `app/api/payments.py`. Recommend including it. |

## Already-present dependencies relied upon

| Package | Already in `requirements.txt`? | Use |
|---------|-------------------------------|-----|
| `python-jose[cryptography]` | Yes (used by auth) | JWT signing for `POST /api/invoices/{id}/pay-link` |
| `pydantic` v2 | Yes | Value objects (`Money`, `PaymentOrder`, `InitiateResult`, …) |
| `fastapi`, `starlette` | Yes | Router + webhook ingress |

## Install commands (Windows PowerShell)

```powershell
cd C:\Users\SAFA\zoho\backend
.\venv\Scripts\Activate.ps1
pip install "stripe>=11.0.0,<13.0.0" "nest_asyncio>=1.6.0"
```

## Environment variables introduced

| Var | Required when | Purpose |
|-----|---------------|---------|
| `STRIPE_SECRET_KEY` | Stripe gateway enabled | `sk_test_…` or `sk_live_…` |
| `STRIPE_PUBLISHABLE_KEY` | Stripe gateway enabled | `pk_test_…` — exposed to browser |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhooks active | `whsec_…` for HMAC verify |
| `PUBLIC_APP_URL` | Pay-link generation | Tenant-facing base URL, e.g. `https://erp.zoho.kurd.iq`. Defaults if unset. |

## Iraqi provider credentials (NOT yet required — R7.2–R7.5)

Stubbed adapters raise `PaymentProviderNotConfigured` if these are missing,
which the API translates to `503`. Set them only after the corresponding R7
question closes:

- `FASTPAY_CLIENT_ID`, `FASTPAY_CLIENT_SECRET`, `FASTPAY_WEBHOOK_SECRET`
- `QI_MERCHANT_ID`, `QI_API_KEY`, `QI_WEBHOOK_SECRET`
- `ZAIN_MERCHANT_ID`, `ZAIN_SECRET`, `ZAIN_MSISDN`
- `ASIA_PAY_MERCHANT_ID`, `ASIA_PAY_API_KEY`

Until set, the corresponding tile in `Settings → Payments → Providers` shows
a `credentials pending` tag and Settings stores the values but transactions
fail cleanly with a 503.
