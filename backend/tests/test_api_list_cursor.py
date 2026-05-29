"""api_list uses list_page when USE_FIRESTORE_QUERY is enabled."""
from unittest.mock import MagicMock, patch

from app.services.firestore_resilience import ListMeta


def test_api_list_uses_list_page_when_flag_on():
    from app.services.api_list import api_list

    repo = MagicMock()
    repo.list_page.return_value = MagicMock(
        items=[{"id": "a"}],
        has_more=True,
        next_cursor="a",
        meta=ListMeta(collection="invoices", org_id="org-1"),
    )

    with patch("app.config.get_settings") as gs:
        gs.return_value.USE_FIRESTORE_QUERY = True
        items, total, cursor = api_list(
            repo, page=1, page_size=20, filters=[], order_by="date"
        )
    assert len(items) == 1
    assert total == 2
    assert cursor == "a"
    repo.list_page.assert_called_once()
