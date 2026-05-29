"""R2.2 — POST /api/items hardening.

  * SKU is auto-generated when not supplied (``ITM-000001``, zero-padded,
    per tenant).
  * Empty / null foreign keys (``tax_id``, ``income_account_id``,
    ``expense_account_id``) MUST NOT 422 — they coerce to None.
  * The frontend's ``income_account_id`` / ``expense_account_id`` aliases map
    onto the legacy storage fields.
  * Existing required field semantics are preserved.
"""
from unittest.mock import patch

from app.api.items import router as ROUTER
from tests.quick_create.conftest import echo_create, make_client, viewer_user

REPO = "app.api.items.ItemRepository"


def _patch_settings():
    return patch(
        "app.api.items.settings_service.get_bag",
        return_value={"default_uom": "Unit", "valuation_method": "FIFO"},
    )


def test_auto_sku_when_missing():
    captured: dict = {}

    def capture(d):
        captured.update(d)
        return {**d, "org_id": "org-1"}

    with patch(REPO) as cls, _patch_settings():
        cls.return_value.list.return_value = ([], 0)
        cls.return_value.create.side_effect = capture
        res = make_client(ROUTER).post(
            "/api/items", json={"name": "T-shirt", "selling_price": 5000}
        )
    assert res.status_code == 201
    assert captured["sku"] == "ITM-000001"


def test_auto_sku_increments_per_tenant():
    """If existing items already use ``ITM-####``, the next is computed."""
    captured: dict = {}

    def capture(d):
        captured.update(d)
        return {**d, "org_id": "org-1"}

    existing = [
        {"sku": "ITM-000001"},
        {"sku": "ITM-000007"},
        {"sku": "RND-ABC"},          # ignored — wrong prefix
        {"sku": "ITM-XYZ"},          # ignored — non-numeric tail
    ]
    with patch(REPO) as cls, _patch_settings():
        cls.return_value.list.return_value = (existing, len(existing))
        cls.return_value.create.side_effect = capture
        res = make_client(ROUTER).post(
            "/api/items", json={"name": "Mug", "selling_price": 1000}
        )
    assert res.status_code == 201
    assert captured["sku"] == "ITM-000008"


def test_explicit_sku_is_respected():
    captured: dict = {}

    def capture(d):
        captured.update(d)
        return {**d, "org_id": "org-1"}

    with patch(REPO) as cls, _patch_settings():
        cls.return_value.list.return_value = ([], 0)
        cls.return_value.create.side_effect = capture
        res = make_client(ROUTER).post(
            "/api/items",
            json={"name": "Custom", "selling_price": 100, "sku": "MY-SKU-1"},
        )
    assert res.status_code == 201
    assert captured["sku"] == "MY-SKU-1"


def test_null_fk_accepted_without_422():
    """Sending ``null`` for FK fields MUST NOT 422 — they map to None."""
    with patch(REPO) as cls, _patch_settings():
        cls.return_value.list.return_value = ([], 0)
        cls.return_value.create.side_effect = echo_create
        res = make_client(ROUTER).post(
            "/api/items",
            json={
                "name": "Item",
                "selling_price": 0,
                "tax_id": None,
                "income_account_id": None,
                "expense_account_id": None,
            },
        )
    assert res.status_code == 201


def test_empty_string_fk_coerced_to_none():
    """The empty-string sentinel produced by an unselected ``<select>`` is
    coerced to None — not rejected.
    """
    captured: dict = {}

    def capture(d):
        captured.update(d)
        return {**d, "org_id": "org-1"}

    with patch(REPO) as cls, _patch_settings():
        cls.return_value.list.return_value = ([], 0)
        cls.return_value.create.side_effect = capture
        res = make_client(ROUTER).post(
            "/api/items",
            json={
                "name": "Item",
                "selling_price": 0,
                "tax_id": "",
                "income_account_id": "",
                "expense_account_id": "",
            },
        )
    assert res.status_code == 201
    assert captured["tax_id"] is None
    assert captured["income_account_id"] is None
    assert captured["expense_account_id"] is None


def test_income_account_alias_maps_to_sales_account():
    """``income_account_id`` from the registry maps onto ``sales_account_id``."""
    captured: dict = {}

    def capture(d):
        captured.update(d)
        return {**d, "org_id": "org-1"}

    with patch(REPO) as cls, _patch_settings():
        cls.return_value.list.return_value = ([], 0)
        cls.return_value.create.side_effect = capture
        res = make_client(ROUTER).post(
            "/api/items",
            json={
                "name": "Item",
                "selling_price": 100,
                "income_account_id": "acc-sales-1",
                "expense_account_id": "acc-cogs-1",
            },
        )
    assert res.status_code == 201
    assert captured["sales_account_id"] == "acc-sales-1"
    assert captured["purchase_account_id"] == "acc-cogs-1"


def test_missing_required_name_returns_422():
    with patch(REPO):
        res = make_client(ROUTER).post(
            "/api/items", json={"selling_price": 10}
        )
    assert res.status_code == 422


def test_permission_denied_returns_403():
    with patch(REPO):
        res = make_client(ROUTER, viewer_user).post(
            "/api/items", json={"name": "Blocked", "selling_price": 0}
        )
    assert res.status_code == 403
