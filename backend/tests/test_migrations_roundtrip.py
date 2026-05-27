"""Wave S7 — migration functions are idempotent."""
from app.firestore.migrations.registry import _contacts_v1_to_v2, _invoices_v1_to_v2


def test_contacts_migration_idempotent():
    doc = {"display_name": "Acme", "schema_version": 1}
    once = _contacts_v1_to_v2(dict(doc))
    twice = _contacts_v1_to_v2(dict(once))
    assert once["display_name_lower"] == "acme"
    assert twice["display_name_lower"] == "acme"


def test_invoices_migration_currency():
    doc = {"total": 50}
    out = _invoices_v1_to_v2(doc)
    assert out["currency_code"] == "IQD"
