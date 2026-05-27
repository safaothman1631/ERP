"""Wave R8 — delete blocked when references exist."""
from unittest.mock import MagicMock, patch

import pytest

from app.firestore.base import BaseRepository
from app.firestore.references import ReferenceConflict


class _ItemRepo(BaseRepository):
    collection_name = "items"


def test_delete_raises_reference_conflict():
    with patch("app.firestore.base.get_db", return_value=MagicMock()), patch(
        "app.services.reference_guard.find_blocking_references",
        return_value=[{"collection": "invoices", "id": "inv-1", "field": "item_id"}],
    ):
        with pytest.raises(ReferenceConflict):
            _ItemRepo("org-1").delete("item-1")
