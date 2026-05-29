"""Atomic POS order checkout: payments + paid state + inventory."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from google.cloud import firestore as fs

from app.firebase_client import get_db
from app.services.pos_inventory import line_quantity, validate_stock_for_lines


class POSCheckoutError(Exception):
    def __init__(self, code: str, message: str = "", **extra: Any):
        self.code = code
        self.extra = extra
        super().__init__(message or code)

    @classmethod
    def from_stock_error(cls, stock_err: dict) -> "POSCheckoutError":
        payload = dict(stock_err)
        code = payload.pop("code", "insufficient_stock")
        return cls(code, **payload)


def checkout_order_atomic(
    org_id: str,
    order_id: str,
    user_id: str,
    payments: list[dict],
    payment_methods: dict[str, dict],
) -> dict:
    """
    payments: list of {payment_method_id, amount, tendered?, reference?}
    payment_methods: id -> method dict (name, etc.)
    """
    from app.firestore.pos import POSOrderLineRepository

    line_repo = POSOrderLineRepository(org_id)
    lines, _ = line_repo.list(
        filters=[{"field": "order_id", "op": "==", "value": order_id}],
        limit=1000,
    )
    stock_err = validate_stock_for_lines(org_id, lines)
    if stock_err:
        raise POSCheckoutError.from_stock_error(stock_err)

    db = get_db()
    order_ref = db.collection("pos_orders").document(order_id)
    now = datetime.utcnow().isoformat()

    item_reads: list[tuple[Any, dict, float]] = []
    for line in lines:
        item_id = line.get("item_id") or line.get("product_id")
        qty = line_quantity(line)
        if not item_id or qty <= 0:
            continue
        item_reads.append((db.collection("items").document(item_id), line, qty))

    @fs.transactional
    def _checkout(transaction: fs.Transaction) -> dict:
        order_snap = order_ref.get(transaction=transaction)
        if not order_snap.exists:
            raise POSCheckoutError("order_not_found")
        order = order_snap.to_dict() or {}
        if order.get("org_id") != org_id:
            raise POSCheckoutError("order_not_found")
        if order.get("state") == "paid":
            raise POSCheckoutError("already_paid", order_id=order_id)
        if order.get("state") != "draft":
            raise POSCheckoutError("invalid_state")

        total_amount = float(order.get("total") or 0)
        payment_sum = sum(float(p.get("amount") or 0) for p in payments)
        if payment_sum + 1e-9 < total_amount:
            raise POSCheckoutError(
                "insufficient_payment",
                payment_sum=payment_sum,
                total=total_amount,
            )

        item_snaps = []
        for item_ref, _line, _qty in item_reads:
            item_snaps.append(item_ref.get(transaction=transaction))

        for payment in payments:
            method_id = payment["payment_method_id"]
            method = payment_methods.get(method_id) or {}
            pay_id = str(uuid.uuid4())
            pay_ref = db.collection("pos_payments").document(pay_id)
            tendered = payment.get("tendered") or payment["amount"]
            transaction.set(
                pay_ref,
                {
                    "org_id": org_id,
                    "order_id": order_id,
                    "session_id": order.get("session_id", ""),
                    "payment_method_id": method_id,
                    "payment_method_name": method.get("name", ""),
                    "amount": payment["amount"],
                    "tendered": tendered,
                    "change": float(tendered) - float(payment["amount"]),
                    "reference": payment.get("reference") or "",
                    "created_at": now,
                    "user_id": user_id,
                },
            )

        transaction.update(
            order_ref,
            {
                "state": "paid",
                "amount_paid": payment_sum,
                "amount_due": 0,
                "updated_at": now,
            },
        )

        for (item_ref, line, qty), item_snap in zip(item_reads, item_snaps):
            if not item_snap.exists:
                continue
            item = item_snap.to_dict() or {}
            if item.get("org_id") != org_id or not item.get("is_trackable", True):
                continue
            current = float(item.get("stock_on_hand", 0) or 0)
            new_qty = current - qty
            transaction.update(item_ref, {"stock_on_hand": new_qty, "updated_at": now})
            mov_ref = db.collection("stock_movements").document(str(uuid.uuid4()))
            transaction.set(
                mov_ref,
                {
                    "org_id": org_id,
                    "item_id": item_ref.id,
                    "quantity": -qty,
                    "type": "pos_sale",
                    "reference_type": "pos_order",
                    "reference_id": order_id,
                    "balance_after": new_qty,
                    "created_at": now,
                    "user_id": user_id,
                },
            )
            from app.cache import cache

            cache.delete(f"items:{item_ref.id}")

        return {
            "message": "Order paid successfully",
            "change": payment_sum - total_amount,
        }

    return _checkout(db.transaction())
