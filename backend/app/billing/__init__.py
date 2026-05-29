"""SaaS subscription billing package (launch-readiness § R5).

This package owns the *platform's* billing of tenants — how Safa charges
customers to use the ERP — distinct from the tenant-side ``app/payments``
package which handles how each tenant collects money from their own buyers.

Modules:
    plans              — Plan + price catalogue (code-of-record).
    stripe             — Stripe Subscriptions adapter (international tenants).
    fastpay_recurring  — Iraqi fallback: monthly invoice + manual payment.
    dunning            — Past-due reminder + suspension state machine.
    trial              — Free-trial countdown and expiry handling.

Integration boundary: ``app/main.py`` registers ``ALL_ROUTERS`` from
``app/api/saas_billing.py`` and ``app/api/saas_admin.py``; nothing in this
package is auto-wired.
"""
from app.billing.plans import PLANS, Plan, get_plan, list_plans

__all__ = ["PLANS", "Plan", "get_plan", "list_plans"]
