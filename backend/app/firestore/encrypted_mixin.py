"""Mixin for repositories that encrypt selected fields at rest."""
from __future__ import annotations

from app.services.crypto import decrypt_doc_fields, encrypt_doc_fields


class EncryptedFieldsMixin:
    _ENCRYPTED_FIELDS: tuple[str, ...] = ()

    def _decrypt_doc(self, doc: dict | None) -> dict | None:
        if not doc:
            return doc
        return decrypt_doc_fields(doc, self._ENCRYPTED_FIELDS)

    def _encrypt_payload(self, data: dict) -> dict:
        return encrypt_doc_fields(data, self._ENCRYPTED_FIELDS)

    def get(self, doc_id: str):
        return self._decrypt_doc(super().get(doc_id))  # type: ignore[misc]

    def list(self, *args, **kwargs):
        items, total = super().list(*args, **kwargs)  # type: ignore[misc]
        return [self._decrypt_doc(i) for i in items], total

    def create(self, data: dict):
        return self._decrypt_doc(super().create(self._encrypt_payload(data)))  # type: ignore[misc]

    def update(self, doc_id: str, data: dict):
        return self._decrypt_doc(super().update(doc_id, self._encrypt_payload(data)))  # type: ignore[misc]
