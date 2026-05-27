"""Field encryption round-trip tests."""
from app.services.crypto import decrypt_field, encrypt_field


def test_encrypt_decrypt_round_trip():
    plain = "1234567890123"
    enc = encrypt_field(plain)
    assert enc.startswith("enc:v1:")
    assert decrypt_field(enc) == plain


def test_legacy_plaintext_passthrough():
    assert decrypt_field("legacy-plain-id") == "legacy-plain-id"


def test_double_encrypt_idempotent():
    plain = "9876543210"
    once = encrypt_field(plain)
    twice = encrypt_field(once)
    assert twice == once


def test_empty_values():
    assert encrypt_field("") == ""
    assert decrypt_field("") == ""
