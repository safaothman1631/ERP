"""Default-adapter registration (called once at app startup).

Importable from ``app/main.py`` with::

    from app.payments.bootstrap import register_default_providers
    register_default_providers()

Adapters that need tenant-specific credentials are still registered — they
raise ``PaymentProviderNotConfigured`` at call time so the API layer can
surface a clean 503. Per-tenant overrides (custom Stripe keys, etc.) layer
on top via ``app/payments/registry.register`` after reading the tenant
config.
"""
from __future__ import annotations

import logging

from app.firestore.payment_repo import PaymentRepository
from app.payments.asia_pay_gateway import AsiaPayGateway
from app.payments.cash_gateway import CashGateway
from app.payments.cod_gateway import CODGateway
from app.payments.fastpay_gateway import FastPayGateway
from app.payments.qi_gateway import QiCardGateway
from app.payments.registry import register
from app.payments.stripe_gateway import StripeGateway
from app.payments.zain_cash_gateway import ZainCashGateway


logger = logging.getLogger(__name__)


def _repo_factory(org_id: str) -> PaymentRepository:
    return PaymentRepository(org_id)


def register_default_providers() -> None:
    """Register the seven adapters with the global registry."""
    register(CashGateway(repo_factory=_repo_factory))
    register(CODGateway(repo_factory=_repo_factory))
    register(StripeGateway(repo_factory=_repo_factory))
    register(FastPayGateway(repo_factory=_repo_factory))
    register(QiCardGateway(repo_factory=_repo_factory))
    register(ZainCashGateway(repo_factory=_repo_factory))
    register(AsiaPayGateway(repo_factory=_repo_factory))
    logger.info("payment providers registered: cash, cod, stripe, fastpay, qi, zain, asia_pay")
