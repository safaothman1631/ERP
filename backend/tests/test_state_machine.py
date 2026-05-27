"""Tests for workflow state machines."""
import pytest
from fastapi import HTTPException

from app.services.state_machine import QUOTE_SM, SALES_ORDER_SM, PURCHASE_ORDER_SM, StateMachine


def test_quote_draft_to_sent():
    doc = {"status": "draft"}
    QUOTE_SM.transition(doc, "sent")
    assert doc["status"] == "sent"


def test_quote_sent_to_accepted():
    doc = {"status": "sent"}
    QUOTE_SM.transition(doc, "accepted")
    assert doc["status"] == "accepted"


def test_quote_invalid_transition_raises():
    doc = {"status": "draft"}
    with pytest.raises(HTTPException) as exc:
        QUOTE_SM.transition(doc, "accepted")
    assert exc.value.status_code == 409
    assert exc.value.detail["code"] == "invalid_state_transition"


def test_quote_terminal_cannot_transition():
    doc = {"status": "cancelled"}
    with pytest.raises(HTTPException):
        QUOTE_SM.transition(doc, "sent")


def test_sales_order_confirmed_to_fulfilled():
    doc = {"status": "confirmed"}
    SALES_ORDER_SM.transition(doc, "fulfilled")
    assert doc["status"] == "fulfilled"


def test_sales_order_confirmed_to_invoiced():
    doc = {"status": "confirmed"}
    SALES_ORDER_SM.transition(doc, "invoiced")
    assert doc["status"] == "invoiced"


def test_purchase_order_sent_to_billed():
    doc = {"status": "sent"}
    PURCHASE_ORDER_SM.transition(doc, "billed")
    assert doc["status"] == "billed"


def test_purchase_order_received_to_billed():
    doc = {"status": "received"}
    PURCHASE_ORDER_SM.transition(doc, "billed")
    assert doc["status"] == "billed"


def test_custom_sm():
    sm = StateMachine({"open": {"closed"}, "closed": set()}, terminal=frozenset({"closed"}))
    doc = {"status": "open"}
    sm.transition(doc, "closed")
    assert doc["status"] == "closed"
