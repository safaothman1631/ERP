"""e-Fakhata signing & cert-storage tests (growth-to-100 § R4 / G4a).

These exercise:
  * upload / load / revoke against the local in-process cert store
  * signing produces a XAdES-BES / XML-DSig envelope
  * verify() rejects tampered XML
  * passwords never escape into log / response surfaces
  * never logging / leaking PKCS#12 bytes

Tests gate on ``signxml`` and ``cryptography`` being importable. If
either is missing the file is skipped — these are optional deps tracked
in ``_deltas/G4a-deps.md``.
"""
from __future__ import annotations

import logging
import os
from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest

# Force the in-process cert store for the entire test module.
os.environ["EFAKHATA_LOCAL_CERT_STORE"] = "1"

pytest.importorskip("lxml")
cryptography = pytest.importorskip("cryptography")
signxml = pytest.importorskip("signxml")

from app.efakhata import cert_storage
from app.efakhata.cert_storage import (
    CertNotFound,
    list_tenant_certs,
    load_tenant_cert,
    revoke_tenant_cert,
    upload_tenant_cert,
)
from app.efakhata.schema import (
    EFakhataAddress,
    EFakhataInvoice,
    EFakhataInvoiceLine,
    EFakhataParty,
    EFakhataTotals,
)
from app.efakhata.signing import (
    SignatureInvalid,
    SigningUnavailable,
    rotate_cert,
    sign,
    verify,
)


# ─────────────────────────────────────────────────────────────────────────────
# Helpers — build a throwaway self-signed PKCS#12 in-memory
# ─────────────────────────────────────────────────────────────────────────────


def _make_self_signed_p12(password: str = "test-pass") -> bytes:
    """Generate an RSA self-signed cert + key and pack into PKCS#12."""
    from cryptography import x509
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives.serialization import pkcs12
    from cryptography.x509.oid import NameOID

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, "Test Tenant"),
        x509.NameAttribute(NameOID.COUNTRY_NAME, "IQ"),
    ])
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.utcnow() - timedelta(minutes=1))
        .not_valid_after(datetime.utcnow() + timedelta(days=365))
        .sign(private_key=key, algorithm=hashes.SHA256())
    )
    encryption = serialization.BestAvailableEncryption(password.encode("utf-8"))
    return pkcs12.serialize_key_and_certificates(
        name=b"test", key=key, cert=cert, cas=None, encryption_algorithm=encryption
    )


def _sample_invoice() -> EFakhataInvoice:
    return EFakhataInvoice(
        invoice_id="inv-sign",
        invoice_number="INV-S-1",
        issue_date=date(2026, 5, 29),
        supplier=EFakhataParty(
            name="Kurd ERP", tax_id="IQ-1",
            address=EFakhataAddress(street="X", city="Erbil", governorate="erbil"),
        ),
        lines=[EFakhataInvoiceLine(
            line_number=1, description="Item", quantity=Decimal("1"),
            unit_price=Decimal("100"), discount_amount=Decimal("0"),
            tax_rate=Decimal("0"), tax_amount=Decimal("0"), line_total=Decimal("100"),
        )],
        totals=EFakhataTotals(subtotal=Decimal("100"), grand_total=Decimal("100")),
    )


@pytest.fixture(autouse=True)
def _reset_local_store():
    """Each test gets a fresh in-process cert store."""
    cert_storage._LOCAL_STORE.clear()
    yield
    cert_storage._LOCAL_STORE.clear()


# ─────────────────────────────────────────────────────────────────────────────
# Cert storage
# ─────────────────────────────────────────────────────────────────────────────


def test_upload_then_load_round_trip():
    p12 = _make_self_signed_p12()
    meta = upload_tenant_cert("org-1", p12, "test-pass")
    assert meta.tenant_id == "org-1"
    assert len(meta.fingerprint) == 64  # sha-256 hex
    loaded_p12, loaded_pwd = load_tenant_cert("org-1")
    assert loaded_p12 == p12
    assert loaded_pwd == "test-pass"


def test_load_missing_tenant_raises_cert_not_found():
    with pytest.raises(CertNotFound):
        load_tenant_cert("nobody")


def test_upload_rejects_empty_bytes_and_password():
    with pytest.raises(ValueError):
        upload_tenant_cert("org-1", b"", "pw")
    with pytest.raises(ValueError):
        upload_tenant_cert("org-1", b"X", "")


def test_revoke_then_load_fails():
    upload_tenant_cert("org-1", _make_self_signed_p12("pw"), "pw")
    revoke_tenant_cert("org-1", reason="rotation")
    with pytest.raises(CertNotFound):
        load_tenant_cert("org-1")


def test_list_returns_metadata_and_skips_password():
    upload_tenant_cert("org-1", _make_self_signed_p12(), "secret-pw")
    items = list_tenant_certs("org-1")
    assert len(items) == 1
    # Metadata serialization MUST NOT carry password anywhere.
    for k, v in items[0].__dict__.items():
        assert "secret-pw" not in str(v)


# ─────────────────────────────────────────────────────────────────────────────
# Signing
# ─────────────────────────────────────────────────────────────────────────────


def test_sign_produces_envelope_with_signature_element():
    upload_tenant_cert("org-1", _make_self_signed_p12("pw"), "pw")
    inv = _sample_invoice()
    xml = inv.to_xml(include_signature_placeholder=True)
    signed = sign(xml, tenant_id="org-1")
    assert b"Signature" in signed
    assert b"SignedInfo" in signed
    assert b"X509Certificate" in signed


def test_sign_then_verify_succeeds():
    upload_tenant_cert("org-1", _make_self_signed_p12("pw"), "pw")
    inv = _sample_invoice()
    xml = inv.to_xml(include_signature_placeholder=True)
    signed = sign(xml, tenant_id="org-1")
    assert verify(signed) is True


def test_verify_rejects_tampered_xml():
    upload_tenant_cert("org-1", _make_self_signed_p12("pw"), "pw")
    inv = _sample_invoice()
    xml = inv.to_xml(include_signature_placeholder=True)
    signed = sign(xml, tenant_id="org-1")
    # Flip a digit in the grand total — payload no longer matches digest.
    tampered = signed.replace(b"100.00", b"999.00", 1)
    if tampered == signed:
        # Fallback in case the 100.00 wasn't present verbatim.
        tampered = signed.replace(b"Item", b"Hack")
    assert tampered != signed
    with pytest.raises(SignatureInvalid):
        verify(tampered)


def test_sign_fails_when_no_cert_uploaded():
    inv = _sample_invoice()
    xml = inv.to_xml(include_signature_placeholder=True)
    with pytest.raises(CertNotFound):
        sign(xml, tenant_id="missing-tenant")


def test_rotate_cert_replaces_previous():
    upload_tenant_cert("org-1", _make_self_signed_p12("old"), "old")
    rotate_cert("org-1", _make_self_signed_p12("new"), "new")
    p12, pwd = load_tenant_cert("org-1")
    assert pwd == "new"


def test_signing_does_not_log_password(caplog):
    upload_tenant_cert("org-1", _make_self_signed_p12("super-secret-pw"), "super-secret-pw")
    inv = _sample_invoice()
    xml = inv.to_xml(include_signature_placeholder=True)
    with caplog.at_level(logging.DEBUG, logger="app.efakhata.signing"):
        sign(xml, tenant_id="org-1")
    combined = " ".join(r.message for r in caplog.records)
    assert "super-secret-pw" not in combined


def test_upload_does_not_log_p12_bytes(caplog):
    p12 = _make_self_signed_p12()
    with caplog.at_level(logging.DEBUG, logger="app.efakhata.cert_storage"):
        upload_tenant_cert("org-1", p12, "pw")
    combined = " ".join(r.message for r in caplog.records).encode("utf-8", "ignore")
    # First 16 bytes of any PKCS#12 should be opaque and not appear in logs.
    assert p12[:16].hex() not in combined.decode("utf-8", "ignore")
