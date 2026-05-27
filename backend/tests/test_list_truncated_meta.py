"""List truncation and degraded meta."""
from unittest.mock import MagicMock, patch

from app.firestore.base import BaseRepository
from app.services.firestore_resilience import LIST_HARD_CAP


class _InvRepo(BaseRepository):
    collection_name = "invoices"


def test_list_truncated_flag():
    with patch("app.firestore.base.get_db", return_value=MagicMock()):
        repo = _InvRepo("org-1")
        fake_docs = []
        for i in range(LIST_HARD_CAP):
            d = MagicMock()
            d.id = f"inv-{i}"
            d.to_dict.return_value = {"org_id": "org-1", "date": "2026-01-01"}
            fake_docs.append(d)
        repo.collection.where.return_value.limit.return_value.stream.return_value = fake_docs
        items, total = repo.list(limit=10)
        assert total == LIST_HARD_CAP
        assert repo.last_list_meta.truncated is True
        assert len(items) == 10


def test_list_quota_degraded():
    with patch("app.firestore.base.get_db", return_value=MagicMock()):
        repo = _InvRepo("org-1")
        from google.api_core.exceptions import ResourceExhausted

        repo.collection.where.return_value.limit.return_value.stream.side_effect = (
            ResourceExhausted("quota")
        )
        items, total = repo.list()
        assert items == []
        assert total == 0
        assert repo.last_list_meta.degraded is True


def test_paginated_response_includes_meta():
    from app.services.list_response import paginated_response

    from app.services.firestore_resilience import ListMeta

    with patch("app.firestore.base.get_db", return_value=MagicMock()):
        repo = _InvRepo("org-1")
        repo.last_list_meta = ListMeta(truncated=True, org_id="org-1", collection="invoices")
        body = paginated_response([{"id": "1"}], 1, 1, 20, repo=repo)
        assert body["meta"]["truncated"] is True
