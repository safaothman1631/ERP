"""Finite-state machine helper for document workflow transitions."""
from __future__ import annotations

from typing import Callable, Optional

from fastapi import HTTPException


class StateMachine:
    """Validates and applies state transitions for ERP documents."""

    def __init__(
        self,
        transitions: dict[str, set[str]],
        *,
        terminal: Optional[frozenset[str]] = None,
    ):
        self._transitions = {k: set(v) for k, v in transitions.items()}
        self._terminal = terminal or frozenset()

    def can_transition(self, src: str, dst: str) -> bool:
        if src in self._terminal:
            return False
        allowed = self._transitions.get(src, set())
        return dst in allowed

    def transition(
        self,
        doc: dict,
        dst: str,
        *,
        state_field: str = "status",
        on_transition: Optional[Callable[[dict, str, str], None]] = None,
    ) -> dict:
        src = (doc.get(state_field) or "draft").lower()
        dst = dst.lower()
        if not self.can_transition(src, dst):
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "invalid_state_transition",
                    "message": f"Cannot transition from '{src}' to '{dst}'",
                    "from": src,
                    "to": dst,
                },
            )
        if on_transition:
            on_transition(doc, src, dst)
        doc[state_field] = dst
        return doc


# Quote: draft → sent → accepted → converted | cancelled
QUOTE_SM = StateMachine({
    "draft": {"sent", "cancelled"},
    "sent": {"accepted", "declined", "cancelled"},
    "accepted": {"converted", "cancelled"},
    "declined": set(),
    "converted": set(),
    "cancelled": set(),
}, terminal=frozenset({"declined", "converted", "cancelled"}))

# Sales order: draft -> confirmed -> fulfilled -> invoiced | cancelled
SALES_ORDER_SM = StateMachine({
    "draft": {"confirmed", "cancelled"},
    "confirmed": {"fulfilled", "partially_fulfilled", "invoiced", "cancelled"},
    "partially_fulfilled": {"fulfilled", "cancelled"},
    "fulfilled": {"invoiced", "cancelled"},
    "invoiced": set(),
    "cancelled": set(),
}, terminal=frozenset({"invoiced", "cancelled"}))

# Purchase order: draft -> sent -> received -> billed | cancelled
PURCHASE_ORDER_SM = StateMachine({
    "draft": {"sent", "cancelled"},
    "sent": {"received", "partially_received", "billed", "cancelled"},
    "partially_received": {"received", "billed", "cancelled"},
    "received": {"billed", "cancelled"},
    "billed": set(),
    "cancelled": set(),
}, terminal=frozenset({"billed", "cancelled"}))
