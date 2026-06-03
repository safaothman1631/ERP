"""MDM API (Pool 3.6) — dedup grouping + merge wiring over the pure engine.

Mock-based: the source repos' ``stream_org_docs`` and the
``GoldenRecordRepository`` are patched so NO live Firestore is hit. We assert
the API correctly drives ``find_duplicate_groups`` / ``merge_golden`` and
persists the golden record.
"""
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.api import mdm as M

_USER = {"org_id": "org1", "id": "u1", "email": "u@x.io"}

_CONTACTS = [
    {"id": "c1", "email": "a@x.io", "name": "Acme", "phone": "111", "updated_at": "2024-01-01"},
    {"id": "c2", "email": "a@x.io", "name": "Acme Inc", "phone": "", "updated_at": "2024-03-01"},
    {"id": "c3", "email": "b@x.io", "name": "Other", "phone": "222", "updated_at": "2024-02-01"},
]


def _patch_source(records):
    """Patch ContactRepository so .stream_org_docs() yields the given records."""
    repo = MagicMock()
    repo.stream_org_docs.return_value = iter(records)
    return patch("app.firestore.contacts.ContactRepository", return_value=repo)


def test_dedup_groups_only_returns_duplicate_sets():
    with _patch_source(_CONTACTS):
        out = M.dedup({"entity": "contacts", "keys": ["email"]}, user=_USER)
    assert out["entity"] == "contacts"
    assert out["record_count"] == 3
    # c1 + c2 share email a@x.io -> one duplicate group of size 2; c3 is a singleton (excluded)
    assert out["duplicate_group_count"] == 1
    grp = out["groups"][0]
    assert grp["size"] == 2
    assert set(grp["ids"]) == {"c1", "c2"}


def test_dedup_no_duplicates_returns_empty_groups():
    with _patch_source(_CONTACTS):
        out = M.dedup({"entity": "contacts", "keys": ["name"]}, user=_USER)
    # names are all distinct -> no group with >1 member
    assert out["duplicate_group_count"] == 0
    assert out["groups"] == []


def test_dedup_rejects_unsupported_entity():
    with pytest.raises(HTTPException) as ei:
        M.dedup({"entity": "widgets", "keys": ["x"]}, user=_USER)
    assert ei.value.status_code == 400


def test_dedup_requires_keys():
    with pytest.raises(HTTPException) as ei:
        M.dedup({"entity": "contacts", "keys": []}, user=_USER)
    assert ei.value.status_code == 400


def test_merge_persists_golden_record():
    created = {}

    def _create(payload):
        created.update(payload)
        return {"id": payload["id"], **payload}

    repo = MagicMock()
    repo.create.side_effect = _create
    with patch.object(M, "GoldenRecordRepository", return_value=repo):
        result = M.merge(
            {"entity": "contacts", "records": [_CONTACTS[0], _CONTACTS[1]]},
            user=_USER,
        )

    repo.create.assert_called_once()
    # recency: c2 (2024-03) wins name; c1's non-empty phone fills the gap c2 left blank
    golden = result["golden"]
    assert golden["name"] == "Acme Inc"
    assert golden["phone"] == "111"
    assert golden["email"] == "a@x.io"
    assert set(golden["_merged_from"]) == {"c1", "c2"}
    # persisted envelope
    assert result["entity"] == "contacts"
    assert set(result["source_ids"]) == {"c1", "c2"}
    assert result["merged_by"] == "u1"
    # identity fields stripped from the merged golden so repo assigns a fresh id/org
    assert "org_id" not in golden


def test_merge_requires_at_least_two_records():
    with pytest.raises(HTTPException) as ei:
        M.merge({"records": [_CONTACTS[0]]}, user=_USER)
    assert ei.value.status_code == 400


def test_list_golden_records_passes_through_repo():
    repo = MagicMock()
    repo.list.return_value = ([{"id": "g1", "entity": "contacts"}], None)
    with patch.object(M, "GoldenRecordRepository", return_value=repo):
        out = M.list_golden_records(user=_USER)
    assert out == [{"id": "g1", "entity": "contacts"}]
    repo.list.assert_called_once_with(order_by="merged_at", order_dir="DESCENDING", limit=200)
