"""A2.11 — Depth-remediation atomic services (import + callable smoke)."""
import importlib
from unittest.mock import MagicMock, patch

import pytest

ATOMIC_MODULES = [
    ("app.services.fiscal_close_atomic", "finalize_fiscal_year_close_atomic"),
    ("app.services.payroll_post_je_atomic", "post_payroll_journal_atomic"),
    ("app.services.grn_receive_atomic", "create_goods_receipt_atomic"),
    ("app.services.po_convert_bill_atomic", "convert_purchase_order_to_bill_atomic"),
    ("app.services.bill_payments", "create_payment_made_with_je_atomic"),
    ("app.services.mo_complete_atomic", "complete_manufacturing_order_atomic"),
    ("app.services.stock_transfer_atomic", "complete_transfer_atomic"),
    ("app.services.warehouse_move_atomic", "validate_stock_move_atomic"),
    ("app.services.journal_entry_atomic", "create_journal_entry_atomic"),
]


@pytest.mark.parametrize("module_name,func_name", ATOMIC_MODULES)
def test_atomic_module_exports_callable(module_name, func_name):
    mod = importlib.import_module(module_name)
    fn = getattr(mod, func_name, None)
    assert callable(fn), f"{module_name}.{func_name} missing"


def test_expenses_api_wires_payment_with_je_atomic():
    """API imports create_payment_made_with_je_atomic when GL lines are built."""
    import inspect
    from app.api import expenses

    src = inspect.getsource(expenses.create_payment_made)
    assert "create_payment_made_with_je_atomic" in src
    assert "void_payment_made_atomic" in inspect.getsource(expenses.void_payment_made)


def test_manufacturing_api_wires_mo_complete_atomic():
    import inspect
    from app.api import manufacturing

    assert "complete_manufacturing_order_atomic" in inspect.getsource(manufacturing.done_order)
    assert "warehouse_id" in inspect.getsource(manufacturing.done_order)


def test_inventory_api_wires_transfer_atomic():
    import inspect
    from app.api import inventory

    assert "complete_transfer_atomic" in inspect.getsource(inventory.complete_transfer)
