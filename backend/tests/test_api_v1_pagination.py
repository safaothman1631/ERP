"""
Unit tests for /api/v1/ pagination, filtering, and error utilities.

Task 8.2: جێبەجێکردنی API بنچینەیی و pagination
"""

import pytest
from unittest.mock import MagicMock


# ─────────────────────────────────────────────────────────────────────────────
# Pagination tests
# ─────────────────────────────────────────────────────────────────────────────

class TestCursorEncoding:
    """Tests for cursor encode/decode round-trip."""

    def test_encode_decode_id_only(self):
        from app.api.v1.pagination import encode_cursor, decode_cursor
        cursor = encode_cursor("doc-123")
        payload = decode_cursor(cursor)
        assert payload["id"] == "doc-123"

    def test_encode_decode_with_sort_value(self):
        from app.api.v1.pagination import encode_cursor, decode_cursor
        cursor = encode_cursor("doc-456", sort_value="2024-01-15")
        payload = decode_cursor(cursor)
        assert payload["id"] == "doc-456"
        assert payload["sv"] == "2024-01-15"

    def test_decode_invalid_cursor_returns_empty(self):
        from app.api.v1.pagination import decode_cursor
        assert decode_cursor("not-valid-base64!!!") == {}
        assert decode_cursor("") == {}
        assert decode_cursor("aW52YWxpZA==") == {}  # valid base64 but not JSON

    def test_cursor_is_url_safe(self):
        """Cursor must not contain URL-unsafe characters."""
        from app.api.v1.pagination import encode_cursor
        cursor = encode_cursor("doc-789", sort_value="some/value+with=special")
        # URL-safe base64 uses - and _ instead of + and /
        assert "+" not in cursor
        assert "/" not in cursor


class TestPaginateList:
    """Tests for paginate_list helper."""

    def _make_params(self, limit=20, cursor=None):
        from app.api.v1.pagination import PaginationParams
        p = MagicMock(spec=PaginationParams)
        p.limit = limit
        p.cursor = cursor
        p.doc_id_after = None
        return p

    def test_no_more_pages(self):
        from app.api.v1.pagination import paginate_list
        items = [{"id": f"doc-{i}"} for i in range(5)]
        params = self._make_params(limit=20)
        result = paginate_list(items, params, total=5)
        assert result["has_more"] is False
        assert result["next_cursor"] is None
        assert len(result["items"]) == 5
        assert result["total"] == 5

    def test_has_more_pages(self):
        from app.api.v1.pagination import paginate_list
        # Fetch limit+1 items to detect more pages
        items = [{"id": f"doc-{i}"} for i in range(21)]  # 21 items, limit=20
        params = self._make_params(limit=20)
        result = paginate_list(items, params, total=100)
        assert result["has_more"] is True
        assert result["next_cursor"] is not None
        assert len(result["items"]) == 20  # Only return limit items

    def test_cursor_points_to_last_item(self):
        from app.api.v1.pagination import paginate_list, decode_cursor
        items = [{"id": f"doc-{i}"} for i in range(21)]
        params = self._make_params(limit=20)
        result = paginate_list(items, params)
        cursor_payload = decode_cursor(result["next_cursor"])
        assert cursor_payload["id"] == "doc-19"  # Last item in page (0-indexed)

    def test_empty_list(self):
        from app.api.v1.pagination import paginate_list
        params = self._make_params(limit=20)
        result = paginate_list([], params, total=0)
        assert result["has_more"] is False
        assert result["next_cursor"] is None
        assert result["items"] == []

    def test_exactly_limit_items(self):
        from app.api.v1.pagination import paginate_list
        items = [{"id": f"doc-{i}"} for i in range(20)]  # Exactly limit
        params = self._make_params(limit=20)
        result = paginate_list(items, params)
        assert result["has_more"] is False
        assert len(result["items"]) == 20

    def test_sort_field_included_in_cursor(self):
        from app.api.v1.pagination import paginate_list, decode_cursor
        items = [{"id": f"doc-{i}", "created_at": f"2024-01-{i+1:02d}"} for i in range(21)]
        params = self._make_params(limit=20)
        result = paginate_list(items, params, sort_field="created_at")
        cursor_payload = decode_cursor(result["next_cursor"])
        assert "sv" in cursor_payload  # Sort value included


class TestLegacyPaginate:
    """Tests for legacy offset-based pagination."""

    def test_basic_pagination(self):
        from app.api.v1.pagination import legacy_paginate
        result = legacy_paginate(items=[], total=100, page=1, page_size=20)
        assert result["total"] == 100
        assert result["page"] == 1
        assert result["page_size"] == 20
        assert result["total_pages"] == 5

    def test_total_pages_rounds_up(self):
        from app.api.v1.pagination import legacy_paginate
        result = legacy_paginate(items=[], total=21, page=1, page_size=20)
        assert result["total_pages"] == 2

    def test_zero_total(self):
        from app.api.v1.pagination import legacy_paginate
        result = legacy_paginate(items=[], total=0, page=1, page_size=20)
        assert result["total_pages"] == 1  # At least 1 page


# ─────────────────────────────────────────────────────────────────────────────
# Filtering tests
# ─────────────────────────────────────────────────────────────────────────────

class TestBuildFilters:
    """Tests for build_filters helper."""

    def test_empty_kwargs(self):
        from app.api.v1.filtering import build_filters
        assert build_filters() == []

    def test_none_values_excluded(self):
        from app.api.v1.filtering import build_filters
        result = build_filters(status=None, contact_id="abc")
        assert len(result) == 1
        assert result[0]["field"] == "contact_id"

    def test_empty_string_excluded(self):
        from app.api.v1.filtering import build_filters
        result = build_filters(status="", contact_id="abc")
        assert len(result) == 1

    def test_multiple_filters(self):
        from app.api.v1.filtering import build_filters
        result = build_filters(status="paid", contact_id="c-123")
        assert len(result) == 2
        fields = {f["field"] for f in result}
        assert fields == {"status", "contact_id"}

    def test_filter_uses_equality_op(self):
        from app.api.v1.filtering import build_filters
        result = build_filters(status="draft")
        assert result[0]["op"] == "=="


class TestFilterParamsApplySearch:
    """Tests for FilterParams.apply_search in-memory text search."""

    def _make_filter_params(self, search=None):
        from app.api.v1.filtering import FilterParams
        fp = MagicMock(spec=FilterParams)
        fp.search = search
        fp.status = None
        fp.contact_id = None
        fp.date_from = None
        fp.date_to = None
        # Bind the real method
        fp.apply_search = FilterParams.apply_search.__get__(fp, FilterParams)
        return fp

    def test_no_search_returns_all(self):
        from app.api.v1.filtering import FilterParams
        fp = FilterParams.__new__(FilterParams)
        fp.search = None
        items = [{"name": "Invoice A"}, {"name": "Invoice B"}]
        result = fp.apply_search(items, ["name"])
        assert len(result) == 2

    def test_search_filters_by_field(self):
        from app.api.v1.filtering import FilterParams
        fp = FilterParams.__new__(FilterParams)
        fp.search = "alpha"
        items = [
            {"name": "Alpha Corp", "email": "a@a.com"},
            {"name": "Beta Ltd", "email": "b@b.com"},
        ]
        result = fp.apply_search(items, ["name", "email"])
        assert len(result) == 1
        assert result[0]["name"] == "Alpha Corp"

    def test_search_is_case_insensitive(self):
        from app.api.v1.filtering import FilterParams
        fp = FilterParams.__new__(FilterParams)
        fp.search = "ALPHA"
        items = [{"name": "alpha corp"}, {"name": "beta ltd"}]
        result = fp.apply_search(items, ["name"])
        assert len(result) == 1

    def test_search_matches_partial(self):
        from app.api.v1.filtering import FilterParams
        fp = FilterParams.__new__(FilterParams)
        fp.search = "INV-"
        items = [
            {"invoice_number": "INV-001"},
            {"invoice_number": "BILL-001"},
        ]
        result = fp.apply_search(items, ["invoice_number"])
        assert len(result) == 1


# ─────────────────────────────────────────────────────────────────────────────
# RFC 7807 Error tests
# ─────────────────────────────────────────────────────────────────────────────

class TestProblemDetail:
    """Tests for RFC 7807 problem_detail builder."""

    def test_required_fields_present(self):
        from app.api.v1.errors import problem_detail
        result = problem_detail(
            status=404,
            title="Not Found",
            detail="Resource not found",
            type_slug="not-found",
        )
        assert result["type"] == "https://erp.example.com/errors/not-found"
        assert result["title"] == "Not Found"
        assert result["status"] == 404
        assert result["detail"] == "Resource not found"

    def test_instance_included_when_provided(self):
        from app.api.v1.errors import problem_detail
        result = problem_detail(
            status=404,
            title="Not Found",
            detail="Not found",
            type_slug="not-found",
            instance="/api/v1/invoices/INV-001",
        )
        assert result["instance"] == "/api/v1/invoices/INV-001"

    def test_instance_absent_when_not_provided(self):
        from app.api.v1.errors import problem_detail
        result = problem_detail(
            status=404,
            title="Not Found",
            detail="Not found",
            type_slug="not-found",
        )
        assert "instance" not in result

    def test_extra_fields_merged(self):
        from app.api.v1.errors import problem_detail
        result = problem_detail(
            status=422,
            title="Validation Error",
            detail="Invalid input",
            type_slug="validation-error",
            extra={"errors": [{"field": "email", "message": "Invalid email"}]},
        )
        assert "errors" in result
        assert result["errors"][0]["field"] == "email"

    def test_type_url_format(self):
        from app.api.v1.errors import problem_detail
        result = problem_detail(404, "Not Found", "detail", "not-found")
        assert result["type"].startswith("https://")
        assert "not-found" in result["type"]


class TestProblemResponses:
    """Tests for convenience problem response functions."""

    def test_not_found_returns_404(self):
        from app.api.v1.errors import not_found
        response = not_found("Invoice", "INV-001")
        assert response.status_code == 404

    def test_forbidden_returns_403(self):
        from app.api.v1.errors import forbidden
        response = forbidden()
        assert response.status_code == 403

    def test_unauthorized_returns_401(self):
        from app.api.v1.errors import unauthorized
        response = unauthorized()
        assert response.status_code == 401

    def test_bad_request_returns_400(self):
        from app.api.v1.errors import bad_request
        response = bad_request("Invalid data")
        assert response.status_code == 400

    def test_unprocessable_returns_422(self):
        from app.api.v1.errors import unprocessable
        response = unprocessable("Validation failed")
        assert response.status_code == 422

    def test_conflict_returns_409(self):
        from app.api.v1.errors import conflict
        response = conflict("Duplicate entry")
        assert response.status_code == 409

    def test_rate_limited_returns_429(self):
        from app.api.v1.errors import rate_limited
        response = rate_limited()
        assert response.status_code == 429

    def test_content_type_is_problem_json(self):
        from app.api.v1.errors import not_found
        response = not_found("Invoice", "INV-001")
        assert response.headers.get("content-type") == "application/problem+json"


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic v2 schema tests
# ─────────────────────────────────────────────────────────────────────────────

class TestCursorPageResponseSchema:
    """Tests for CursorPageResponse Pydantic v2 schema."""

    def test_valid_response(self):
        from app.api.v1.schemas import CursorPageResponse
        data = {
            "items": [{"id": "1"}, {"id": "2"}],
            "next_cursor": "abc123",
            "has_more": True,
            "total": 100,
        }
        page = CursorPageResponse[dict](**data)
        assert page.has_more is True
        assert page.next_cursor == "abc123"
        assert len(page.items) == 2

    def test_no_more_pages(self):
        from app.api.v1.schemas import CursorPageResponse
        page = CursorPageResponse[dict](items=[], next_cursor=None, has_more=False, total=0)
        assert page.has_more is False
        assert page.next_cursor is None

    def test_total_is_optional(self):
        from app.api.v1.schemas import CursorPageResponse
        page = CursorPageResponse[dict](items=[], has_more=False)
        assert page.total is None


class TestProblemDetailSchema:
    """Tests for ProblemDetail Pydantic v2 schema."""

    def test_valid_problem_detail(self):
        from app.api.v1.schemas import ProblemDetail
        pd = ProblemDetail(
            type="https://erp.example.com/errors/not-found",
            title="Not Found",
            status=404,
            detail="Resource not found",
        )
        assert pd.status == 404
        assert pd.instance is None

    def test_with_instance(self):
        from app.api.v1.schemas import ProblemDetail
        pd = ProblemDetail(
            type="https://erp.example.com/errors/not-found",
            title="Not Found",
            status=404,
            detail="Not found",
            instance="/api/v1/invoices/INV-001",
        )
        assert pd.instance == "/api/v1/invoices/INV-001"


class TestFilterSpecSchema:
    """Tests for FilterSpec Pydantic v2 schema."""

    def test_valid_equality_filter(self):
        from app.api.v1.schemas import FilterSpec
        f = FilterSpec(field="status", op="==", value="paid")
        assert f.field == "status"
        assert f.op == "=="

    def test_in_operator_requires_list(self):
        from app.api.v1.schemas import FilterSpec
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            FilterSpec(field="status", op="in", value="paid")  # Should be a list

    def test_in_operator_with_list(self):
        from app.api.v1.schemas import FilterSpec
        f = FilterSpec(field="status", op="in", value=["paid", "draft"])
        assert f.value == ["paid", "draft"]

    def test_invalid_operator_rejected(self):
        from app.api.v1.schemas import FilterSpec
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            FilterSpec(field="status", op="LIKE", value="paid")
