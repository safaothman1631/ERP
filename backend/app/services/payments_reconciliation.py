"""Nightly reconciliation job (launch-readiness § R4.12).

For each provider that supports a ``get_settlements`` API:
  1. Pull yesterday's settlement entries from the provider.
  2. Match each entry against ``Payment`` documents by ``provider_charge_id``.
  3. Mark matched as ``settled`` with ``settled_at``.
  4. Unmatched entries → open an issue in ``ReconciliationQueueRepository``.

The job is scheduled via APScheduler; the scheduling itself is wired in
``backend/app/main.py`` (we don't touch that file — the constraint is in the
task spec). The reconciliation **function** is fully implemented and can be
called from any scheduler or from a CLI.

For v1, only Stripe has a real ``get_settlements``. Iraqi providers raise
``NotImplementedError`` until R7.x closes — the runner catches and logs.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Any, Iterable

from app.firestore.payment_repo import (
    PaymentRepository,
    ReconciliationQueueRepository,
)
from app.payments.gateway import PaymentProviderNotConfigured, PaymentStatus
from app.payments.registry import list_registered, get as get_provider


logger = logging.getLogger(__name__)


class ReconciliationReport:
    """Result of one provider × one tenant × one day run."""

    def __init__(self, provider_slug: str, org_id: str, settlement_date: date):
        self.provider_slug = provider_slug
        self.org_id = org_id
        self.settlement_date = settlement_date
        self.matched: int = 0
        self.unmatched_inbound: int = 0
        self.unmatched_outbound: int = 0
        self.skipped_reason: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "provider_slug": self.provider_slug,
            "org_id": self.org_id,
            "settlement_date": self.settlement_date.isoformat(),
            "matched": self.matched,
            "unmatched_inbound": self.unmatched_inbound,
            "unmatched_outbound": self.unmatched_outbound,
            "skipped_reason": self.skipped_reason,
        }


async def reconcile_provider_for_tenant(
    provider_slug: str,
    org_id: str,
    settlement_date: date,
) -> ReconciliationReport:
    """Reconcile one (provider, tenant) for ``settlement_date``."""
    report = ReconciliationReport(provider_slug, org_id, settlement_date)
    try:
        provider = get_provider(provider_slug)
    except KeyError:
        report.skipped_reason = "provider_not_registered"
        return report

    fetch = getattr(provider, "get_settlements", None)
    if fetch is None:
        report.skipped_reason = "provider_does_not_support_settlements"
        return report

    date_from = datetime.combine(settlement_date, time.min)
    date_to = datetime.combine(settlement_date + timedelta(days=1), time.min)

    try:
        settlements = await fetch(date_from=date_from, date_to=date_to)
    except NotImplementedError:
        report.skipped_reason = "credentials_pending"
        return report
    except PaymentProviderNotConfigured as exc:
        report.skipped_reason = f"not_configured:{exc}"
        return report
    except Exception as exc:
        logger.exception("reconcile fetch failed for %s/%s: %s",
                         provider_slug, org_id, exc)
        report.skipped_reason = f"fetch_error:{exc}"
        return report

    payments_repo = PaymentRepository(org_id)
    queue_repo = ReconciliationQueueRepository(org_id)

    # Inbound matching: every settlement should have a local Payment.
    for entry in settlements:
        provider_ref = entry.get("source") or entry.get("id")
        if not provider_ref:
            continue
        local = payments_repo.find_by_provider_reference(provider_slug, provider_ref)
        if local is None:
            queue_repo.open_issue(
                provider_slug=provider_slug,
                kind="unmatched_inbound",
                description=f"Settlement {provider_ref} has no local Payment",
                settlement_date=settlement_date.isoformat(),
                provider_reference=provider_ref,
                expected_amount=str(entry.get("amount", "")),
            )
            report.unmatched_inbound += 1
            continue
        # Amount sanity check.
        try:
            settled_amt = Decimal(str(entry["amount"]))
            local_amt = Decimal(str(local["amount"]))
            # Allow exact match or refund pair (sign-flipped).
            if abs(abs(settled_amt) - abs(local_amt)) > Decimal("0.01"):
                queue_repo.open_issue(
                    provider_slug=provider_slug,
                    kind="amount_mismatch",
                    description=(
                        f"Settlement {provider_ref}: expected {local_amt}, "
                        f"got {settled_amt}"
                    ),
                    settlement_date=settlement_date.isoformat(),
                    provider_reference=provider_ref,
                    local_payment_id=local["id"],
                    expected_amount=str(local_amt),
                    actual_amount=str(settled_amt),
                )
                continue
        except Exception:
            pass
        payments_repo.update_status(
            local["id"], PaymentStatus.settled,
            actor=f"reconcile:{provider_slug}",
        )
        report.matched += 1

    # Outbound: succeeded payments that the provider didn't settle.
    settled_refs = {(s.get("source") or s.get("id")) for s in settlements}
    succeeded_locally = [
        p for p in payments_repo.list_by_status(PaymentStatus.succeeded, limit=500)
        if p.get("provider_slug") == provider_slug
        and p.get("created_at") and _within_day(p["created_at"], settlement_date)
    ]
    for local in succeeded_locally:
        if local.get("provider_charge_id") not in settled_refs:
            queue_repo.open_issue(
                provider_slug=provider_slug,
                kind="unmatched_outbound",
                description=(
                    f"Local payment {local['id']} marked succeeded but not "
                    f"in provider settlement for {settlement_date.isoformat()}"
                ),
                settlement_date=settlement_date.isoformat(),
                provider_reference=local.get("provider_charge_id"),
                local_payment_id=local["id"],
                expected_amount=str(local["amount"]),
            )
            report.unmatched_outbound += 1

    return report


def _within_day(created_at: Any, day: date) -> bool:
    """Return True if ``created_at`` falls on ``day`` (UTC)."""
    if isinstance(created_at, str):
        try:
            created_at = datetime.fromisoformat(created_at.replace("Z", ""))
        except Exception:
            return False
    if not isinstance(created_at, datetime):
        return False
    return created_at.date() == day


async def run_nightly_reconciliation(
    org_ids: Iterable[str],
    *,
    settlement_date: date | None = None,
) -> list[ReconciliationReport]:
    """Entry point for the APScheduler job.

    Walks every (provider, tenant) and produces per-pair reports. Wire from
    main.py with:

        scheduler.add_job(
            lambda: asyncio.run(run_nightly_reconciliation(active_org_ids())),
            trigger="cron", hour=2, minute=15,
        )
    """
    if settlement_date is None:
        settlement_date = (datetime.utcnow() - timedelta(days=1)).date()
    reports: list[ReconciliationReport] = []
    for slug in list_registered():
        for org_id in org_ids:
            reports.append(
                await reconcile_provider_for_tenant(slug, org_id, settlement_date)
            )
    return reports
