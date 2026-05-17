"""
Unit tests for backend/app/services/settings_service.py

Covers:
  - get_bag: returns defaults when no Firestore data exists
  - get_bag: merges stored data on top of defaults (server precedence, Req 11.5)
  - get_bag: caches results and serves from cache within TTL
  - get_bag: organisation scoping — different org_ids return independent bags (Req 11.4)
  - set_bag: persists data to Firestore and invalidates cache (Req 11.2)
  - set_bag: raises ValueError for invalid arguments
  - invalidate: drops cache for a specific category
  - invalidate: drops all categories for an org when category is None
  - invalidate_all: clears the entire cache

Requirements: 11.2, 11.4, 11.5
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Make the backend package importable when running from the tests directory
# ---------------------------------------------------------------------------
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# ---------------------------------------------------------------------------
# Helpers / stubs
# ---------------------------------------------------------------------------

def _make_repo_stub(stored_value: Optional[Dict[str, Any]] = None):
    """Return a mock SettingsRepository that returns *stored_value* on list()."""
    repo = MagicMock()
    if stored_value is not None:
        doc = {"id": "doc-1", "key": "blob", "category": "test", "value": json.dumps(stored_value)}
        repo.list.return_value = ([doc], 1)
    else:
        repo.list.return_value = ([], 0)
    repo.create.side_effect = lambda payload: {"id": "new-doc", **payload}
    repo.update.side_effect = lambda doc_id, payload: {"id": doc_id, **payload}
    return repo


# ===========================================================================
# Fixtures
# ===========================================================================

@pytest.fixture(autouse=True)
def clear_cache():
    """Ensure the in-process cache is empty before and after every test."""
    import app.services.settings_service as svc
    svc.invalidate_all()
    yield
    svc.invalidate_all()


# ===========================================================================
# get_bag — basic behaviour
# ===========================================================================

class TestGetBag:
    """Tests for get_bag() — Requirement 11.2, 11.4, 11.5."""

    def test_returns_defaults_when_no_firestore_data(self):
        """get_bag should return defaults when Firestore has no stored blob."""
        import app.services.settings_service as svc

        defaults = {"theme": "light", "lang": "ku"}
        stub = _make_repo_stub(stored_value=None)

        with patch("app.services.settings_service.SettingsRepository", return_value=stub):
            result = svc.get_bag("org-1", "ui", defaults)

        assert result == defaults

    def test_stored_values_override_defaults(self):
        """Server-stored values must override caller-supplied defaults (Req 11.5)."""
        import app.services.settings_service as svc

        defaults = {"theme": "light", "lang": "ku", "density": "compact"}
        stored = {"theme": "dark"}  # only theme is stored
        stub = _make_repo_stub(stored_value=stored)

        with patch("app.services.settings_service.SettingsRepository", return_value=stub):
            result = svc.get_bag("org-1", "ui", defaults)

        # Stored value wins
        assert result["theme"] == "dark"
        # Default fills in missing keys
        assert result["lang"] == "ku"
        assert result["density"] == "compact"

    def test_returns_copy_safe_to_mutate(self):
        """get_bag must return a new dict; mutating it must not affect the cache."""
        import app.services.settings_service as svc

        stored = {"key": "original"}
        stub = _make_repo_stub(stored_value=stored)

        with patch("app.services.settings_service.SettingsRepository", return_value=stub):
            result1 = svc.get_bag("org-1", "cat", {})
            result1["key"] = "mutated"
            result2 = svc.get_bag("org-1", "cat", {})

        assert result2["key"] == "original"

    def test_empty_org_id_returns_defaults_without_firestore(self):
        """Empty org_id must return defaults immediately without hitting Firestore."""
        import app.services.settings_service as svc

        stub = _make_repo_stub()
        defaults = {"a": 1}

        with patch("app.services.settings_service.SettingsRepository", return_value=stub):
            result = svc.get_bag("", "cat", defaults)

        stub.list.assert_not_called()
        assert result == defaults

    def test_empty_category_returns_defaults_without_firestore(self):
        """Empty category must return defaults immediately without hitting Firestore."""
        import app.services.settings_service as svc

        stub = _make_repo_stub()
        defaults = {"b": 2}

        with patch("app.services.settings_service.SettingsRepository", return_value=stub):
            result = svc.get_bag("org-1", "", defaults)

        stub.list.assert_not_called()
        assert result == defaults

    def test_firestore_error_falls_back_to_defaults(self):
        """If Firestore raises, get_bag must silently fall back to defaults."""
        import app.services.settings_service as svc

        stub = MagicMock()
        stub.list.side_effect = RuntimeError("Firestore unavailable")
        defaults = {"fallback": True}

        with patch("app.services.settings_service.SettingsRepository", return_value=stub):
            result = svc.get_bag("org-1", "cat", defaults)

        assert result == defaults

    # -----------------------------------------------------------------------
    # Caching
    # -----------------------------------------------------------------------

    def test_second_call_uses_cache_not_firestore(self):
        """A second call within TTL must not hit Firestore again."""
        import app.services.settings_service as svc

        stored = {"cached": True}
        stub = _make_repo_stub(stored_value=stored)

        with patch("app.services.settings_service.SettingsRepository", return_value=stub):
            svc.get_bag("org-1", "cat", {})
            svc.get_bag("org-1", "cat", {})

        # list() should only have been called once (first call)
        assert stub.list.call_count == 1

    def test_cache_expires_after_ttl(self):
        """After TTL expires, the next call must re-read from Firestore."""
        import app.services.settings_service as svc

        stored = {"v": 1}
        stub = _make_repo_stub(stored_value=stored)

        with patch("app.services.settings_service.SettingsRepository", return_value=stub):
            with patch("app.services.settings_service._TTL_SECONDS", 0.01):
                svc.get_bag("org-1", "cat", {})
                time.sleep(0.05)
                svc.get_bag("org-1", "cat", {})

        assert stub.list.call_count == 2

    # -----------------------------------------------------------------------
    # Organisation scoping (Requirement 11.4)
    # -----------------------------------------------------------------------

    def test_different_orgs_return_independent_bags(self):
        """Two different org_ids must never share cached settings (Req 11.4)."""
        import app.services.settings_service as svc

        stub_a = _make_repo_stub(stored_value={"org": "A"})
        stub_b = _make_repo_stub(stored_value={"org": "B"})

        call_count = [0]
        stubs = [stub_a, stub_b]

        def _factory(org_id):
            idx = call_count[0] % 2
            call_count[0] += 1
            return stubs[idx]

        with patch("app.services.settings_service.SettingsRepository", side_effect=_factory):
            result_a = svc.get_bag("org-A", "cat", {})
            result_b = svc.get_bag("org-B", "cat", {})

        assert result_a["org"] == "A"
        assert result_b["org"] == "B"

    def test_same_category_different_orgs_are_cached_independently(self):
        """Cache keys must include org_id so orgs don't share entries (Req 11.4)."""
        import app.services.settings_service as svc

        stub_a = _make_repo_stub(stored_value={"x": 1})
        stub_b = _make_repo_stub(stored_value={"x": 99})

        call_count = [0]
        stubs = [stub_a, stub_b]

        def _factory(org_id):
            idx = call_count[0] % 2
            call_count[0] += 1
            return stubs[idx]

        with patch("app.services.settings_service.SettingsRepository", side_effect=_factory):
            r1 = svc.get_bag("org-A", "shared-cat", {})
            r2 = svc.get_bag("org-B", "shared-cat", {})

        assert r1["x"] != r2["x"]


# ===========================================================================
# set_bag — persistence (Requirement 11.2)
# ===========================================================================

class TestSetBag:
    """Tests for set_bag() — Requirement 11.2, 11.4."""

    def test_creates_new_document_when_none_exists(self):
        """set_bag must call repo.create() when no blob exists for the category."""
        import app.services.settings_service as svc

        stub = _make_repo_stub(stored_value=None)

        with patch("app.services.settings_service.SettingsRepository", return_value=stub):
            svc.set_bag("org-1", "branding", {"logo": "url"})

        stub.create.assert_called_once()
        call_payload = stub.create.call_args[0][0]
        assert call_payload["key"] == "blob"
        assert call_payload["category"] == "branding"
        stored_data = json.loads(call_payload["value"])
        assert stored_data["logo"] == "url"

    def test_updates_existing_document_when_blob_exists(self):
        """set_bag must call repo.update() when a blob already exists."""
        import app.services.settings_service as svc

        stub = _make_repo_stub(stored_value={"logo": "old-url"})

        with patch("app.services.settings_service.SettingsRepository", return_value=stub):
            svc.set_bag("org-1", "branding", {"logo": "new-url"})

        stub.update.assert_called_once()
        call_payload = stub.update.call_args[0][1]
        stored_data = json.loads(call_payload["value"])
        assert stored_data["logo"] == "new-url"

    def test_set_bag_invalidates_cache(self):
        """After set_bag, the next get_bag must re-read from Firestore."""
        import app.services.settings_service as svc

        stub = _make_repo_stub(stored_value={"v": 1})

        with patch("app.services.settings_service.SettingsRepository", return_value=stub):
            # Populate cache
            svc.get_bag("org-1", "cat", {})
            count_after_first_read = stub.list.call_count  # 1

            # Write new data — set_bag also calls list() internally to find existing blob
            svc.set_bag("org-1", "cat", {"v": 2})
            count_after_write = stub.list.call_count  # 2 (1 read + 1 from set_bag)

            # Cache should be invalidated; next get_bag must hit Firestore again
            svc.get_bag("org-1", "cat", {})
            assert stub.list.call_count == count_after_write + 1

    def test_raises_value_error_for_empty_org_id(self):
        """set_bag must raise ValueError when org_id is empty."""
        import app.services.settings_service as svc

        with pytest.raises(ValueError, match="org_id"):
            svc.set_bag("", "cat", {"k": "v"})

    def test_raises_value_error_for_empty_category(self):
        """set_bag must raise ValueError when category is empty."""
        import app.services.settings_service as svc

        with pytest.raises(ValueError, match="category"):
            svc.set_bag("org-1", "", {"k": "v"})

    def test_raises_value_error_for_non_dict_data(self):
        """set_bag must raise ValueError when data is not a dict."""
        import app.services.settings_service as svc

        with pytest.raises(ValueError, match="dict"):
            svc.set_bag("org-1", "cat", ["not", "a", "dict"])  # type: ignore[arg-type]

    def test_set_bag_is_org_scoped(self):
        """set_bag for org-A must not affect org-B's cached data (Req 11.4)."""
        import app.services.settings_service as svc

        stub_a = _make_repo_stub(stored_value={"v": "A"})
        stub_b = _make_repo_stub(stored_value={"v": "B"})

        call_count = [0]
        stubs = [stub_a, stub_b]

        def _factory(org_id):
            idx = call_count[0] % 2
            call_count[0] += 1
            return stubs[idx]

        with patch("app.services.settings_service.SettingsRepository", side_effect=_factory):
            # Populate cache for org-B
            svc.get_bag("org-B", "cat", {})
            # Write for org-A — should not invalidate org-B's cache
            svc.set_bag("org-A", "cat", {"v": "A-new"})
            # org-B should still be served from cache (no extra Firestore call)
            svc.get_bag("org-B", "cat", {})

        # org-B's stub.list should have been called exactly once (initial load)
        assert stub_b.list.call_count == 1


# ===========================================================================
# invalidate / invalidate_all
# ===========================================================================

class TestInvalidate:
    """Tests for invalidate() and invalidate_all()."""

    def test_invalidate_specific_category_forces_refetch(self):
        """invalidate(org, cat) must cause the next get_bag to re-read Firestore."""
        import app.services.settings_service as svc

        stub = _make_repo_stub(stored_value={"v": 1})

        with patch("app.services.settings_service.SettingsRepository", return_value=stub):
            svc.get_bag("org-1", "cat", {})
            assert stub.list.call_count == 1

            svc.invalidate("org-1", "cat")
            svc.get_bag("org-1", "cat", {})
            assert stub.list.call_count == 2

    def test_invalidate_all_categories_for_org(self):
        """invalidate(org) without category must drop all cached categories for that org."""
        import app.services.settings_service as svc

        stub = _make_repo_stub(stored_value={"v": 1})

        with patch("app.services.settings_service.SettingsRepository", return_value=stub):
            svc.get_bag("org-1", "cat-a", {})
            svc.get_bag("org-1", "cat-b", {})
            assert stub.list.call_count == 2

            svc.invalidate("org-1")  # no category → drop all for org-1
            svc.get_bag("org-1", "cat-a", {})
            svc.get_bag("org-1", "cat-b", {})
            assert stub.list.call_count == 4

    def test_invalidate_does_not_affect_other_orgs(self):
        """invalidate(org-A) must not drop cached entries for org-B."""
        import app.services.settings_service as svc

        stub = _make_repo_stub(stored_value={"v": 1})

        with patch("app.services.settings_service.SettingsRepository", return_value=stub):
            svc.get_bag("org-A", "cat", {})
            svc.get_bag("org-B", "cat", {})
            assert stub.list.call_count == 2

            svc.invalidate("org-A", "cat")
            svc.get_bag("org-A", "cat", {})  # re-fetches
            svc.get_bag("org-B", "cat", {})  # still cached
            assert stub.list.call_count == 3

    def test_invalidate_all_clears_entire_cache(self):
        """invalidate_all() must clear every cached entry."""
        import app.services.settings_service as svc

        stub = _make_repo_stub(stored_value={"v": 1})

        with patch("app.services.settings_service.SettingsRepository", return_value=stub):
            svc.get_bag("org-A", "cat-a", {})
            svc.get_bag("org-B", "cat-b", {})
            assert stub.list.call_count == 2

            svc.invalidate_all()
            svc.get_bag("org-A", "cat-a", {})
            svc.get_bag("org-B", "cat-b", {})
            assert stub.list.call_count == 4
