"""Wave C — optimistic concurrency via apply_versioned_update."""
import pytest
from fastapi import HTTPException

from app.firestore.base import VersionConflict
from app.services.versioned_update import apply_versioned_update
from tests.fakes.repo import FakeRepo


def test_apply_versioned_update_success():
    repo = FakeRepo("org-1")
    repo.create({"id": "c1", "name": "A"})
    out = apply_versioned_update(repo, "c1", {"name": "B"}, if_match='W/"1"')
    assert out["name"] == "B"
    assert out["_version"] == 2


def test_apply_versioned_update_conflict():
    repo = FakeRepo("org-1")
    repo.create({"id": "c1", "name": "A"})
    with pytest.raises(HTTPException) as exc:
        apply_versioned_update(repo, "c1", {"name": "B"}, if_match="99")
    assert exc.value.status_code == 409
    assert exc.value.detail["code"] == "version_conflict"


def test_apply_versioned_without_header_falls_back():
    repo = FakeRepo("org-1")
    repo.create({"id": "c1", "name": "A"})
    out = apply_versioned_update(repo, "c1", {"name": "C"})
    assert out["name"] == "C"
