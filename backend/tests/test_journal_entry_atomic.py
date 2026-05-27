"""Journal entry atomic service."""
from datetime import datetime
from unittest.mock import MagicMock, patch


def test_create_journal_entry_atomic_writes_balances_in_transaction():
    from app.services.journal_entry_atomic import create_journal_entry_atomic

    mock_db = MagicMock()
    tx = MagicMock()
    mock_db.transaction.return_value = tx

    je_ref = MagicMock()
    je_lines_ref = MagicMock()
    je_ref.collection.return_value = je_lines_ref
    je_collection = MagicMock()
    je_collection.document.return_value = je_ref

    seq_ref = MagicMock()
    seq_snap = MagicMock()
    seq_snap.exists = False
    seq_ref.get.return_value = seq_snap
    seq_collection = MagicMock()
    seq_collection.document.return_value = seq_ref

    acc_asset_ref = MagicMock()
    acc_asset_snap = MagicMock()
    acc_asset_snap.exists = True
    acc_asset_snap.to_dict.return_value = {"org_id": "org-1", "account_type": "asset"}
    acc_asset_ref.get.return_value = acc_asset_snap

    acc_liab_ref = MagicMock()
    acc_liab_snap = MagicMock()
    acc_liab_snap.exists = True
    acc_liab_snap.to_dict.return_value = {"org_id": "org-1", "account_type": "liability"}
    acc_liab_ref.get.return_value = acc_liab_snap

    acc_collection = MagicMock()
    acc_collection.document.side_effect = (
        lambda doc_id: {"acc-asset": acc_asset_ref, "acc-liab": acc_liab_ref}[doc_id]
    )

    def _collection(name: str):
        if name == "journal_entries":
            return je_collection
        if name == "sequences":
            return seq_collection
        if name == "accounts":
            return acc_collection
        return MagicMock()

    mock_db.collection.side_effect = _collection

    lines = [
        {"account_id": "acc-asset", "debit": 100, "credit": 0, "description": "debit"},
        {"account_id": "acc-liab", "debit": 0, "credit": 100, "description": "credit"},
    ]

    with patch("app.services.journal_entry_atomic.get_db", return_value=mock_db), patch(
        "app.services.journal_entry_atomic.fs.transactional", lambda f: f
    ), patch(
        "app.services.journal_entry_atomic.fs.Increment",
        side_effect=lambda v: {"__increment__": v},
    ), patch(
        "app.services.journal_entry_atomic.cache.delete"
    ):
        result = create_journal_entry_atomic(
            "org-1",
            date=datetime(2026, 1, 31),
            lines=lines,
            description="Payroll posting",
            source_type="payroll",
            source_id="run-1",
        )

    assert result["entry_number"] == "JOU-000001"
    assert any(call.args[0] is seq_ref for call in tx.set.call_args_list)
    assert any(call.args[0] is je_ref for call in tx.set.call_args_list)

    balance_updates = {
        call.args[0]: call.args[1]
        for call in tx.update.call_args_list
        if len(call.args) >= 2 and "balance" in call.args[1]
    }
    assert balance_updates[acc_asset_ref]["balance"]["__increment__"] == 100
    assert balance_updates[acc_liab_ref]["balance"]["__increment__"] == 100
