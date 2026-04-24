from .base import BaseRepository


class EInvoiceSubmissionRepository(BaseRepository):
    """Repository for Iraq e-invoice submission records."""

    collection_name = "einvoice_submissions"

    def get_by_invoice_id(self, invoice_id: str):
        items, _ = self.list(
            filters=[{"field": "invoice_id", "op": "==", "value": invoice_id}],
            limit=1,
        )
        return items[0] if items else None

    def get_by_provider_uuid(self, provider_uuid: str):
        items, _ = self.list(
            filters=[{"field": "provider_uuid", "op": "==", "value": provider_uuid}],
            limit=1,
        )
        return items[0] if items else None