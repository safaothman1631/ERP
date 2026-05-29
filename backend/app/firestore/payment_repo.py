"""``Payment`` aggregate repository (launch-readiness § R4.10).

Stored at ``tenants/{org_id}/payments/{pid}`` — i.e. inside the org's
collection scope enforced by ``BaseRepository``. Required composite indices
(deployed via ``firestore.indexes.json``):

* (org_id, status, created_at DESC)
* (org_id, provider_slug, provider_charge_id)
* (org_id, invoice_id, created_at DESC)

The shape is intentionally provider-agnostic — adapter-specific blobs live
under ``provider_data``. Refunds are stored as separate ``Payment`` documents
with negative amounts, linked via ``parent_payment_id`` (matches the Stripe
"refund as charge" convention and lets the GL reversal post symmetric JEs).
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional

from app.firestore.base import BaseRepository
from app.payments.gateway import PaymentStatus


class PaymentRepository(BaseRepository):
    collection_name = "payments"

    # Status values that count as terminal — webhooks for these are no-ops.
    TERMINAL_STATUSES = frozenset(
        {
            PaymentStatus.succeeded.value,
            PaymentStatus.settled.value,
            PaymentStatus.refunded.value,
            PaymentStatus.failed.value,
            PaymentStatus.cancelled.value,
            PaymentStatus.returned.value,
        }
    )

    def create_payment(
        self,
        *,
        provider_slug: str,
        amount: Decimal,
        currency: str,
        status: PaymentStatus,
        invoice_id: Optional[str] = None,
        pos_sale_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        provider_reference: Optional[str] = None,
        provider_data: Optional[dict[str, Any]] = None,
        parent_payment_id: Optional[str] = None,
        idempotency_key: Optional[str] = None,
        created_by: Optional[str] = None,
    ) -> dict:
        """Create the canonical Payment document.

        Refunds pass ``parent_payment_id`` to chain to the original charge.
        """
        return self.create(
            {
                "id": str(uuid.uuid4()),
                "provider_slug": provider_slug,
                "amount": str(amount),       # store as string for Decimal fidelity
                "currency": currency.upper(),
                "status": status.value,
                "invoice_id": invoice_id,
                "pos_sale_id": pos_sale_id,
                "customer_id": customer_id,
                "provider_reference": provider_reference,
                "provider_charge_id": provider_reference,
                "provider_data": provider_data or {},
                "parent_payment_id": parent_payment_id,
                "idempotency_key": idempotency_key,
                "created_by": created_by,
                "audit_trail": [
                    {
                        "at": datetime.utcnow().isoformat(),
                        "status": status.value,
                        "actor": created_by or "system",
                    }
                ],
            }
        )

    def update_status(
        self,
        payment_id: str,
        new_status: PaymentStatus,
        *,
        actor: str = "system",
        provider_reference: Optional[str] = None,
        provider_data: Optional[dict[str, Any]] = None,
    ) -> dict:
        """Append-only status change. Idempotent against terminal states."""
        current = self.get(payment_id)
        if current is None:
            raise LookupError(f"payment_not_found:{payment_id}")
        if current.get("status") == new_status.value:
            return current
        if current.get("status") in self.TERMINAL_STATUSES and new_status not in {
            PaymentStatus.refunded,
            PaymentStatus.partially_refunded,
            PaymentStatus.settled,
        }:
            # Don't downgrade a terminal payment.
            return current
        trail = list(current.get("audit_trail") or [])
        trail.append(
            {
                "at": datetime.utcnow().isoformat(),
                "status": new_status.value,
                "actor": actor,
            }
        )
        patch: dict[str, Any] = {"status": new_status.value, "audit_trail": trail}
        if provider_reference:
            patch["provider_reference"] = provider_reference
            patch["provider_charge_id"] = provider_reference
        if provider_data:
            merged = dict(current.get("provider_data") or {})
            merged.update(provider_data)
            patch["provider_data"] = merged
        if new_status in {PaymentStatus.succeeded, PaymentStatus.delivered}:
            patch["captured_at"] = datetime.utcnow().isoformat()
        if new_status == PaymentStatus.settled:
            patch["settled_at"] = datetime.utcnow().isoformat()
        return self.update(payment_id, patch)

    def list_by_status(self, status: PaymentStatus, limit: int = 50) -> list[dict]:
        items, _ = self.list(
            filters=[{"field": "status", "op": "==", "value": status.value}],
            order_by="created_at",
            order_dir="DESCENDING",
            limit=limit,
        )
        return items

    def list_by_invoice(self, invoice_id: str, limit: int = 50) -> list[dict]:
        items, _ = self.list(
            filters=[{"field": "invoice_id", "op": "==", "value": invoice_id}],
            order_by="created_at",
            order_dir="DESCENDING",
            limit=limit,
        )
        return items

    def list_by_provider(self, provider_slug: str, limit: int = 100) -> list[dict]:
        items, _ = self.list(
            filters=[{"field": "provider_slug", "op": "==", "value": provider_slug}],
            order_by="created_at",
            order_dir="DESCENDING",
            limit=limit,
        )
        return items

    def find_by_provider_reference(
        self, provider_slug: str, provider_reference: str
    ) -> Optional[dict]:
        """Used by webhook handlers + reconciliation to resolve the local Payment."""
        items, _ = self.list(
            filters=[
                {"field": "provider_slug", "op": "==", "value": provider_slug},
                {"field": "provider_charge_id", "op": "==", "value": provider_reference},
            ],
            limit=1,
        )
        return items[0] if items else None


class WebhookEventLogRepository(BaseRepository):
    """Idempotency log for inbound webhooks.

    Stored at ``tenants/{org_id}/webhook_events/{event_id}`` with TTL 7 days.
    A dedup key of ``(provider_slug, provider_event_id)`` prevents replay.
    """

    collection_name = "webhook_events"

    def has_seen(self, provider_slug: str, provider_event_id: str) -> bool:
        items, _ = self.list(
            filters=[
                {"field": "provider_slug", "op": "==", "value": provider_slug},
                {"field": "provider_event_id", "op": "==", "value": provider_event_id},
            ],
            limit=1,
        )
        return bool(items)

    def record(
        self, provider_slug: str, provider_event_id: str, event_type: str, payload: dict
    ) -> dict:
        return self.create(
            {
                "id": str(uuid.uuid4()),
                "provider_slug": provider_slug,
                "provider_event_id": provider_event_id,
                "event_type": event_type,
                "payload": payload,
                "ttl_at": (datetime.utcnow().isoformat()),  # cleanup job removes >7d
            }
        )


class ReconciliationQueueRepository(BaseRepository):
    """Per-tenant reconciliation queue surfaced by the Settings UI."""

    collection_name = "payment_reconciliation_queue"

    def open_issue(
        self,
        *,
        provider_slug: str,
        kind: str,                # 'unmatched_inbound' | 'unmatched_outbound' | 'amount_mismatch'
        description: str,
        settlement_date: str,
        provider_reference: Optional[str] = None,
        local_payment_id: Optional[str] = None,
        expected_amount: Optional[str] = None,
        actual_amount: Optional[str] = None,
    ) -> dict:
        return self.create(
            {
                "id": str(uuid.uuid4()),
                "provider_slug": provider_slug,
                "kind": kind,
                "description": description,
                "settlement_date": settlement_date,
                "provider_reference": provider_reference,
                "local_payment_id": local_payment_id,
                "expected_amount": expected_amount,
                "actual_amount": actual_amount,
                "status": "open",
            }
        )

    def resolve(self, issue_id: str, *, resolution: str, actor: str) -> dict:
        return self.update(
            issue_id,
            {
                "status": "resolved",
                "resolution": resolution,
                "resolved_by": actor,
                "resolved_at": datetime.utcnow().isoformat(),
            },
        )
