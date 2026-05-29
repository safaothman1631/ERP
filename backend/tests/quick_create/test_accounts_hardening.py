"""R2.4 — POST /api/accounts hardening.

  * Auto-generate ``code`` per Iraqi 5-digit convention:
      asset 10000-19999, liability 20000-29999, equity 30000-39999,
      revenue/income 40000-49999, expense 50000-59999.
  * Validate ``parent_id``: parent must exist AND its ``account_type`` must
    match the child's type.
  * Detect cycles in the parent chain and reject with ``account.cycle_detected``.
"""
from unittest.mock import patch

from app.api.accounts import router as ROUTER
from tests.quick_create.conftest import echo_create, make_client, viewer_user

REPO = "app.api.accounts.AccountRepository"


def _patch_repo(existing_accounts=None, by_id=None):
    """Returns a configured patch context for ``AccountRepository``.

    ``existing_accounts`` seeds the ``.list()`` return value;
    ``by_id`` is a dict for ``.get(id)`` lookups.
    """
    by_id = by_id or {}
    existing_accounts = existing_accounts or []

    cls_patch = patch(REPO)
    cls = cls_patch.start()
    repo = cls.return_value
    repo.list.return_value = (existing_accounts, len(existing_accounts))
    repo.get.side_effect = lambda aid: by_id.get(aid)
    repo.create.side_effect = echo_create
    return cls_patch, repo


def test_auto_code_asset_starts_at_10000():
    captured: dict = {}

    def capture(d):
        captured.update(d)
        return {**d, "org_id": "org-1"}

    cls_patch, repo = _patch_repo()
    try:
        repo.create.side_effect = capture
        res = make_client(ROUTER).post(
            "/api/accounts",
            json={"name": "Cash on hand", "account_type": "asset"},
        )
    finally:
        cls_patch.stop()
    assert res.status_code == 201
    assert captured["code"] == "10000"


def test_auto_code_liability_in_20000_range():
    captured: dict = {}

    def capture(d):
        captured.update(d)
        return {**d, "org_id": "org-1"}

    cls_patch, repo = _patch_repo()
    try:
        repo.create.side_effect = capture
        res = make_client(ROUTER).post(
            "/api/accounts",
            json={"name": "AP", "account_type": "liability"},
        )
    finally:
        cls_patch.stop()
    assert res.status_code == 201
    code = int(captured["code"])
    assert 20000 <= code <= 29999


def test_auto_code_expense_in_50000_range():
    captured: dict = {}

    def capture(d):
        captured.update(d)
        return {**d, "org_id": "org-1"}

    cls_patch, repo = _patch_repo()
    try:
        repo.create.side_effect = capture
        res = make_client(ROUTER).post(
            "/api/accounts",
            json={"name": "Rent", "account_type": "expense"},
        )
    finally:
        cls_patch.stop()
    assert res.status_code == 201
    code = int(captured["code"])
    assert 50000 <= code <= 59999


def test_auto_code_skips_used_values():
    """If 10000 is taken, the next free slot is 10001."""
    captured: dict = {}

    def capture(d):
        captured.update(d)
        return {**d, "org_id": "org-1"}

    cls_patch, repo = _patch_repo(
        existing_accounts=[
            {"id": "a1", "account_type": "asset", "code": "10000"},
            {"id": "a2", "account_type": "asset", "code": "10001"},
            {"id": "a3", "account_type": "asset", "code": "10003"},
        ]
    )
    try:
        repo.create.side_effect = capture
        res = make_client(ROUTER).post(
            "/api/accounts",
            json={"name": "Bank", "account_type": "asset"},
        )
    finally:
        cls_patch.stop()
    assert res.status_code == 201
    assert captured["code"] == "10002"


def test_explicit_code_is_respected():
    captured: dict = {}

    def capture(d):
        captured.update(d)
        return {**d, "org_id": "org-1"}

    cls_patch, repo = _patch_repo()
    try:
        repo.create.side_effect = capture
        res = make_client(ROUTER).post(
            "/api/accounts",
            json={"name": "Petty cash", "account_type": "asset", "code": "11150"},
        )
    finally:
        cls_patch.stop()
    assert res.status_code == 201
    assert captured["code"] == "11150"


def test_parent_type_mismatch_returns_422():
    """A liability child under an asset parent is rejected."""
    cls_patch, repo = _patch_repo(
        by_id={"p1": {"id": "p1", "account_type": "asset", "code": "10000", "name": "Assets"}}
    )
    try:
        res = make_client(ROUTER).post(
            "/api/accounts",
            json={"name": "AP", "account_type": "liability", "parent_id": "p1"},
        )
    finally:
        cls_patch.stop()
    assert res.status_code == 422
    detail = res.json()["detail"]
    assert detail["code"] == "account.parent_type_mismatch"


def test_parent_not_found_returns_422():
    cls_patch, repo = _patch_repo()
    try:
        res = make_client(ROUTER).post(
            "/api/accounts",
            json={"name": "X", "account_type": "asset", "parent_id": "nope"},
        )
    finally:
        cls_patch.stop()
    assert res.status_code == 422
    detail = res.json()["detail"]
    assert detail["code"] == "account.parent_not_found"


def test_parent_same_type_succeeds():
    captured: dict = {}

    def capture(d):
        captured.update(d)
        return {**d, "org_id": "org-1"}

    cls_patch, repo = _patch_repo(
        by_id={"p1": {"id": "p1", "account_type": "asset", "code": "10000", "name": "Assets"}}
    )
    try:
        repo.create.side_effect = capture
        res = make_client(ROUTER).post(
            "/api/accounts",
            json={"name": "Cash", "account_type": "asset", "parent_id": "p1"},
        )
    finally:
        cls_patch.stop()
    assert res.status_code == 201
    assert captured["parent_id"] == "p1"


def test_cycle_in_parent_chain_returns_422():
    """If p1.parent_id == p2 and p2.parent_id == p1, attaching under p1 trips
    the cycle detector."""
    p1 = {"id": "p1", "account_type": "asset", "parent_id": "p2"}
    p2 = {"id": "p2", "account_type": "asset", "parent_id": "p1"}
    cls_patch, repo = _patch_repo(by_id={"p1": p1, "p2": p2})
    try:
        res = make_client(ROUTER).post(
            "/api/accounts",
            json={"name": "Sub", "account_type": "asset", "parent_id": "p1"},
        )
    finally:
        cls_patch.stop()
    assert res.status_code == 422
    detail = res.json()["detail"]
    assert detail["code"] == "account.cycle_detected"


def test_permission_denied_returns_403():
    with patch(REPO):
        res = make_client(ROUTER, viewer_user).post(
            "/api/accounts",
            json={"name": "X", "account_type": "asset"},
        )
    assert res.status_code == 403


def test_missing_required_fields_returns_422():
    with patch(REPO):
        res = make_client(ROUTER).post(
            "/api/accounts", json={"name": "Only name"}
        )
    assert res.status_code == 422
