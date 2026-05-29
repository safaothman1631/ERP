"""Wave O9 — documents over 950 KiB are rejected."""
import pytest

from app.firestore.base import DOC_SIZE_HARD_BYTES, BaseRepository


def test_doc_size_hard_limit():
    huge = {"x": "a" * (DOC_SIZE_HARD_BYTES + 1000)}
    with pytest.raises(ValueError, match="doc_size_exceeded"):
        BaseRepository._check_doc_size("items", huge)
