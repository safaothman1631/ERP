"""COGS posting for the warehouse goods-out (picking-done) path.

When a picking is marked DONE (stock physically leaves the warehouse for a sale),
post ``Dr Cost of Goods Sold / Cr Inventory`` at standard cost (item.cost_price ×
qty), summed over the stocked lines. Idempotent (a ``gl_posted_cogs`` guard flag +
a deterministic uuid5 entry id) and soft-skips when the chart of accounts is not
configured — mirrors app/services/invoice_gl.py. NEVER raises into the caller.

Cost basis = standard cost (item.cost_price). Moving-average / FIFO perpetual
valuation is a separate, larger piece; this gives correct COGS for the common
standard-cost setup and is reversible if the cost model changes later.
"""
from __future__ import annotations

import logging
import uuid

from fastapi import HTTPException

from app.services.accounting import AccountingService

logger = logging.getLogger(__name__)


def _cogs_je_id(picking_id: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"picking-cogs:{picking_id}"))


def _total_standard_cost(org_id: str, picking: dict) -> float:
    """Sum item.cost_price × qty over stocked lines. Service items
    (track_inventory is False) contribute nothing."""
    from app.firestore.items import ItemRepository

    item_repo = ItemRepository(org_id)
    cache: dict[str, dict] = {}
    total = 0.0
    for line in picking.get("lines") or []:
        item_id = line.get("item_id")
        qty = float(line.get("qty") or line.get("quantity") or 0)
        if not item_id or qty <= 0:
            continue
        item = cache.get(item_id)
        if item is None:
            item = item_repo.get(item_id) or {}
            cache[item_id] = item
        if item.get("track_inventory") is False:
            continue
        total += float(item.get("cost_price") or 0) * qty
    return round(total, 2)


def post_picking_cogs_je(org_id: str, picking: dict, *, created_by: str | None = None):
    """Post Dr COGS / Cr Inventory at standard cost for a DONE picking.

    Idempotent on the ``gl_posted_cogs`` flag + a deterministic entry id. Returns
    the JE, ``{"skipped": ...}`` when already posted, or None (nothing stocked /
    chart of accounts missing). Never raises.
    """
    if not picking:
        return None
    if picking.get("gl_posted_cogs") and picking.get("cogs_journal_entry_id"):
        return {"id": picking["cogs_journal_entry_id"], "skipped": "already_posted"}

    total_cost = _total_standard_cost(org_id, picking)
    if total_cost <= 0:
        return None

    entry_id = _cogs_je_id(picking["id"])
    try:
        return AccountingService.create_cogs_journal(
            org_id,
            {
                "id": picking["id"],
                "reference": picking.get("reference") or picking.get("number") or picking["id"],
                "date": picking.get("done_at") or picking.get("confirmed_at"),
                "_je_entry_id": entry_id,
                "created_by": created_by,
            },
            total_cost,
        )
    except HTTPException as exc:
        # 404 = chart of accounts (COGS / Inventory) missing -> soft-skip.
        logger.warning("COGS JE skipped for picking %s: %s", picking.get("id"), exc.detail)
        return None
