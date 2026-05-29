"""e-Fakhata XML schema tests (growth-to-100 § R4 / G4a).

These verify:
  * EFakhataInvoice model validation (pydantic guards)
  * to_xml() / from_xml() round-trip
  * builder mapping from a Firestore-shaped invoice dict
  * decimal serialization (no float drift)
  * supported-version registry
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

pytest.importorskip("lxml")

from app.efakhata.builder import EFakhataBuilder, EFakhataBuildError
from app.efakhata.schema import (
    EFakhataAddress,
    EFakhataInvoice,
    EFakhataInvoiceLine,
    EFakhataParty,
    EFakhataTotals,
)
from app.efakhata.version_registry import (
    current_version,
    is_supported,
    latest,
    migrate,
    supported_versions,
)


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures
# ─────────────────────────────────────────────────────────────────────────────


def _supplier() -> EFakhataParty:
    return EFakhataParty(
        name="Kurd ERP Co.",
        tax_id="IQ-TAX-123456",
        address=EFakhataAddress(
            street="Salim St.",
            city="Erbil",
            governorate="erbil",
            postal_code="44001",
            country="IQ",
        ),
        phone="+9647501234567",
        email="billing@kurderp.iq",
    )


def _customer() -> EFakhataParty:
    return EFakhataParty(
        name="Customer Co.",
        tax_id="IQ-TAX-999",
        address=EFakhataAddress(
            street="Mosul Rd.",
            city="Baghdad",
            governorate="baghdad",
        ),
    )


def _line(n=1, qty=Decimal("2"), price=Decimal("50000"),
          tax_rate=Decimal("0"), tax_amount=Decimal("0")) -> EFakhataInvoiceLine:
    return EFakhataInvoiceLine(
        line_number=n,
        description=f"Service {n}",
        quantity=qty,
        unit_price=price,
        discount_amount=Decimal("0"),
        tax_rate=tax_rate,
        tax_amount=tax_amount,
        line_total=qty * price,
    )


def _invoice(currency="IQD") -> EFakhataInvoice:
    line = _line()
    return EFakhataInvoice(
        invoice_id="inv-1",
        invoice_number="INV-2026-001",
        issue_date=date(2026, 5, 29),
        supplier=_supplier(),
        customer=_customer(),
        lines=[line],
        totals=EFakhataTotals(
            subtotal=Decimal("100000"),
            grand_total=Decimal("100000"),
        ),
        currency=currency,
        exchange_rate=Decimal("1") if currency == "IQD" else Decimal("1450"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Schema tests
# ─────────────────────────────────────────────────────────────────────────────


def test_invoice_validates_required_fields():
    inv = _invoice()
    assert inv.invoice_id == "inv-1"
    assert inv.supplier.tax_id == "IQ-TAX-123456"
    assert len(inv.lines) == 1


def test_iqd_must_have_exchange_rate_one():
    with pytest.raises(ValueError):
        EFakhataInvoice(
            invoice_id="x", invoice_number="X",
            issue_date=date(2026, 1, 1),
            supplier=_supplier(),
            lines=[_line()],
            totals=EFakhataTotals(subtotal=Decimal("100"), grand_total=Decimal("100")),
            currency="IQD",
            exchange_rate=Decimal("1450"),
        )


def test_usd_allows_custom_exchange_rate():
    inv = _invoice(currency="USD")
    assert inv.currency == "USD"
    assert inv.exchange_rate == Decimal("1450")


def test_unsupported_currency_rejected():
    with pytest.raises(ValueError):
        EFakhataInvoice(
            invoice_id="x", invoice_number="X",
            issue_date=date(2026, 1, 1),
            supplier=_supplier(),
            lines=[_line()],
            totals=EFakhataTotals(subtotal=Decimal("100"), grand_total=Decimal("100")),
            currency="GBP",
        )


def test_to_xml_produces_valid_utf8_document():
    inv = _invoice()
    xml = inv.to_xml()
    assert xml.startswith(b"<?xml")
    assert b"InvoiceID" in xml
    assert b"INV-2026-001" in xml
    assert b"Kurd ERP Co." in xml
    # Ensure XML is parseable.
    from lxml import etree
    root = etree.fromstring(xml)
    assert root.tag.endswith("}Invoice")


def test_to_xml_includes_signature_placeholder_when_requested():
    inv = _invoice()
    xml = inv.to_xml(include_signature_placeholder=True)
    assert b"Signature" in xml
    assert b'Id="signature"' in xml


def test_decimal_serialization_no_float_drift():
    inv = _invoice()
    xml = inv.to_xml()
    # 100000.00 — not 100000 or 1E+05
    assert b"100000.00" in xml


def test_xml_round_trip_preserves_core_fields():
    original = _invoice()
    xml = original.to_xml()
    parsed = EFakhataInvoice.from_xml(xml)
    assert parsed.invoice_id == original.invoice_id
    assert parsed.invoice_number == original.invoice_number
    assert parsed.issue_date == original.issue_date
    assert parsed.supplier.name == original.supplier.name
    assert parsed.customer.name == original.customer.name
    assert parsed.lines[0].description == original.lines[0].description
    assert parsed.totals.grand_total == original.totals.grand_total


def test_b2c_invoice_omits_customer_block():
    inv = _invoice()
    inv = inv.model_copy(update={"customer": None})
    xml = inv.to_xml()
    assert b"Customer" not in xml


# ─────────────────────────────────────────────────────────────────────────────
# Builder tests
# ─────────────────────────────────────────────────────────────────────────────


def test_builder_maps_minimal_invoice_dict():
    invoice_dict = {
        "id": "inv-2",
        "invoice_number": "INV-2026-002",
        "date": "2026-05-29",
        "lines": [
            {"description": "Consulting", "quantity": 1, "unit_price": 75000,
             "tax_rate": 0, "tax_amount": 0, "line_total": 75000},
        ],
        "subtotal": 75000,
        "total": 75000,
        "currency_code": "IQD",
    }
    supplier_profile = {
        "name": "Kurd ERP Co.",
        "tax_id": "IQ-TAX-1",
        "address": {"street": "X", "city": "Erbil", "governorate": "erbil"},
    }
    model = EFakhataBuilder.from_invoice(
        invoice_dict, supplier_profile=supplier_profile,
    )
    assert model.invoice_number == "INV-2026-002"
    assert model.lines[0].line_total == Decimal("75000")
    assert model.customer is None


def test_builder_requires_supplier_tax_id():
    supplier = {"name": "S", "address": {"street": "x", "city": "y", "governorate": "erbil"}}
    with pytest.raises(EFakhataBuildError, match="tax_id"):
        EFakhataBuilder.from_invoice(
            {"id": "i", "invoice_number": "N", "date": "2026-01-01",
             "lines": [{"description": "x", "quantity": 1, "unit_price": 1,
                        "line_total": 1}], "total": 1},
            supplier_profile=supplier,
        )


def test_builder_rejects_empty_lines():
    supplier = {"name": "S", "tax_id": "T", "address": {"street": "x", "city": "y",
                                                         "governorate": "erbil"}}
    with pytest.raises(EFakhataBuildError, match="lines"):
        EFakhataBuilder.from_invoice(
            {"id": "i", "invoice_number": "N", "date": "2026-01-01",
             "lines": [], "total": 0},
            supplier_profile=supplier,
        )


def test_builder_normalizes_fractional_tax_rate_to_percent():
    """A tax_rate of 0.05 (= 5%) must map to 5.0 in the XML — not 0.05."""
    supplier = {"name": "S", "tax_id": "T",
                "address": {"street": "x", "city": "y", "governorate": "erbil"}}
    model = EFakhataBuilder.from_invoice(
        {"id": "i", "invoice_number": "N", "date": "2026-01-01",
         "lines": [{"description": "x", "quantity": 1, "unit_price": 100,
                    "tax_rate": 0.05, "tax_amount": 5, "line_total": 105}],
         "total": 105},
        supplier_profile=supplier,
    )
    assert model.lines[0].tax_rate == Decimal("5")


# ─────────────────────────────────────────────────────────────────────────────
# Version registry
# ─────────────────────────────────────────────────────────────────────────────


def test_current_version_is_1_0():
    assert current_version == "1.0"


def test_supported_versions_contains_current():
    assert current_version in supported_versions()
    assert is_supported("1.0")
    assert not is_supported("99.0")


def test_latest_returns_highest_dotted_version():
    assert latest() == "1.0"


def test_migrate_same_version_is_identity():
    payload = b"<x/>"
    assert migrate(payload, from_version="1.0", to_version="1.0") == payload


def test_migrate_unknown_pair_raises():
    with pytest.raises(NotImplementedError):
        migrate(b"<x/>", from_version="1.0", to_version="2.0")
