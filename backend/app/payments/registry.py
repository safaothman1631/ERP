"""Runtime registry of payment provider adapters (launch-readiness § R4.1).

Adapters register themselves at import time so the API layer can look them up
by ``slug``. Per-tenant enablement is layered on top via ``list_enabled``
which reads the tenant's ``payment_providers`` config document.
"""
from __future__ import annotations

from typing import Any, Optional

from app.payments.gateway import PaymentGateway


_REGISTRY: dict[str, PaymentGateway] = {}


class ProviderNotRegistered(KeyError):
    """Raised by ``get`` when the slug has never been ``register()``ed."""


def register(provider: PaymentGateway) -> None:
    """Register an adapter instance keyed by its ``slug``.

    Re-registration replaces the existing entry — useful in tests. The slug
    must be a non-empty lowercase ASCII identifier.
    """
    slug = getattr(provider, "slug", None)
    if not slug or not isinstance(slug, str):
        raise ValueError("provider must expose a non-empty `slug` attribute")
    _REGISTRY[slug] = provider


def get(slug: str) -> PaymentGateway:
    """Look up a registered adapter.

    Raises ``ProviderNotRegistered`` if missing; callers should translate to a
    404 at the API layer.
    """
    if slug not in _REGISTRY:
        raise ProviderNotRegistered(slug)
    return _REGISTRY[slug]


def list_registered() -> list[str]:
    """Return all known slugs (regardless of tenant enablement)."""
    return sorted(_REGISTRY.keys())


class TenantPaymentConfig:
    """Lightweight view of a tenant's payment_providers config document.

    Real config lives at ``tenants/{tid}/payment_providers/{slug}``; this is
    just the shape ``list_enabled`` consumes. Kept here rather than importing
    a Firestore doc class to keep the registry test-friendly.
    """

    def __init__(self, enabled_slugs: set[str], settings: Optional[dict[str, dict[str, Any]]] = None):
        self.enabled_slugs = set(enabled_slugs)
        self.settings = settings or {}


def list_enabled(tenant_config: TenantPaymentConfig) -> list[PaymentGateway]:
    """Return adapters the tenant has explicitly enabled, preserving slug order."""
    return [_REGISTRY[s] for s in sorted(tenant_config.enabled_slugs) if s in _REGISTRY]


def clear() -> None:
    """Test helper — drop every registered provider."""
    _REGISTRY.clear()
