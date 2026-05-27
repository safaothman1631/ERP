"""Tenant isolation on BaseRepository.get()."""
from unittest.mock import MagicMock, patch

from app.firestore.base import BaseRepository


class _TestRepo(BaseRepository):
    collection_name = "test_docs"


def test_get_returns_none_when_org_mismatch():
    with patch("app.firestore.base.get_db", return_value=MagicMock()):
        repo = _TestRepo("org-a")
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.id = "doc-1"
        mock_doc.to_dict.return_value = {"org_id": "org-b", "name": "secret"}

        with patch.object(repo.collection, "document") as mock_document:
            mock_document.return_value.get.return_value = mock_doc
            with patch("app.firestore.base.cache") as mock_cache:
                mock_cache.get.return_value = None
                assert repo.get("doc-1") is None
                mock_cache.delete.assert_called_with("test_docs:doc-1")


def test_get_invalidates_cache_on_org_mismatch():
    with patch("app.firestore.base.get_db", return_value=MagicMock()):
        repo = _TestRepo("org-a")
        with patch("app.firestore.base.cache") as mock_cache:
            mock_cache.get.return_value = {"id": "doc-1", "org_id": "org-b", "name": "x"}
            assert repo.get("doc-1") is None
            mock_cache.delete.assert_called_with("test_docs:doc-1")


def test_get_returns_doc_when_org_matches():
    with patch("app.firestore.base.get_db", return_value=MagicMock()):
        repo = _TestRepo("org-a")
        mock_doc = MagicMock()
        mock_doc.exists = True
        mock_doc.id = "doc-1"
        mock_doc.to_dict.return_value = {"org_id": "org-a", "name": "ok"}

        with patch.object(repo.collection, "document") as mock_document:
            mock_document.return_value.get.return_value = mock_doc
            with patch("app.firestore.base.cache") as mock_cache:
                mock_cache.get.return_value = None
                result = repo.get("doc-1")
                assert result is not None
                assert result["id"] == "doc-1"
                assert result["name"] == "ok"
