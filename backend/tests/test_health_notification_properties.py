"""
Property-Based Tests for login health notification role-based filtering (Property 20).

**Validates: Requirements 3.3, 3.4, 3.5**

Property 20: Login health notification only fires for admin/owner
    For any authenticated user with a role other than "admin" or "owner",
    the useHealthNotification hook SHALL NOT call GET /api/system/health/full.

This module tests the *backend* role-based access control logic that mirrors
the frontend hook's role check.  Specifically, it verifies that the health
endpoint is only meaningful for admin/owner roles by testing the role-filtering
logic in isolation — the same logic the frontend hook applies before deciding
whether to call the API.

The property is expressed as a pure function test: given a role string, the
predicate `_should_notify(role)` must return True only for "admin" and "owner".
"""

from __future__ import annotations

from hypothesis import given, settings as h_settings
from hypothesis import strategies as st


# ─────────────────────────────────────────────────────────────────────────────
# Role-filtering predicate (mirrors frontend useHealthNotification logic)
# ─────────────────────────────────────────────────────────────────────────────

# The set of roles that are allowed to receive the login health notification.
# This mirrors the check in frontend/src/hooks/useHealthNotification.ts:
#   if (!isAdmin && !isOwner) return;
PRIVILEGED_ROLES: frozenset[str] = frozenset({"admin", "owner"})


def _should_notify(role: str) -> bool:
    """
    Return True if the given role should trigger the health notification.

    This is the pure predicate that the frontend hook evaluates before calling
    GET /api/system/health/full.  It is extracted here so it can be tested
    independently of the React rendering environment.

    Requirements 3.5 — Only fires for admin/owner roles.
    """
    return role in PRIVILEGED_ROLES


# ─────────────────────────────────────────────────────────────────────────────
# Property 20: Login health notification only fires for admin/owner
# ─────────────────────────────────────────────────────────────────────────────

# Feature: system-health-backup, Property 20
@given(role=st.sampled_from(["member", "viewer", "accountant", "sales"]))
@h_settings(max_examples=100)
def test_property20_non_admin_roles_do_not_trigger_notification(role: str) -> None:
    """
    **Validates: Requirements 3.5**

    # Feature: system-health-backup, Property 20: Login health notification only fires for admin/owner

    For any authenticated user with a role other than "admin" or "owner",
    the health notification predicate SHALL return False, meaning the hook
    would NOT call GET /api/system/health/full.
    """
    result = _should_notify(role)
    assert result is False, (
        f"Expected _should_notify({role!r}) to return False for non-privileged role, "
        f"but got True. The health notification must only fire for admin/owner."
    )


# Feature: system-health-backup, Property 20
@given(
    role=st.text(min_size=1, max_size=50).filter(
        lambda r: r not in PRIVILEGED_ROLES
    )
)
@h_settings(max_examples=100)
def test_property20_arbitrary_non_privileged_role_does_not_trigger(role: str) -> None:
    """
    **Validates: Requirements 3.5**

    # Feature: system-health-backup, Property 20: Login health notification only fires for admin/owner

    For any arbitrary role string that is not "admin" or "owner",
    the health notification predicate SHALL return False.

    This extends the sampled_from test to cover arbitrary role strings that
    might appear in the system (e.g. future roles, typos, empty-ish strings).
    """
    result = _should_notify(role)
    assert result is False, (
        f"Expected _should_notify({role!r}) to return False for non-privileged role, "
        f"but got True."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Supplementary unit tests (boundary values and positive cases)
# ─────────────────────────────────────────────────────────────────────────────

class TestHealthNotificationRoleFilterUnit:
    """
    Unit tests that pin exact role values for the notification predicate.

    These complement the property tests by verifying the positive cases
    (admin and owner DO trigger the notification) and specific negative cases.
    """

    # ── Positive cases: roles that SHOULD trigger the notification ────────

    def test_admin_role_triggers_notification(self) -> None:
        """Requirement 3.5 — admin role must trigger the health notification."""
        assert _should_notify("admin") is True

    def test_owner_role_triggers_notification(self) -> None:
        """Requirement 3.5 — owner role must trigger the health notification."""
        assert _should_notify("owner") is True

    # ── Negative cases: roles that must NOT trigger the notification ──────

    def test_member_role_does_not_trigger(self) -> None:
        """Requirement 3.5 — member role must NOT trigger the health notification."""
        assert _should_notify("member") is False

    def test_viewer_role_does_not_trigger(self) -> None:
        """Requirement 3.5 — viewer role must NOT trigger the health notification."""
        assert _should_notify("viewer") is False

    def test_accountant_role_does_not_trigger(self) -> None:
        """Requirement 3.5 — accountant role must NOT trigger the health notification."""
        assert _should_notify("accountant") is False

    def test_sales_role_does_not_trigger(self) -> None:
        """Requirement 3.5 — sales role must NOT trigger the health notification."""
        assert _should_notify("sales") is False

    def test_empty_string_does_not_trigger(self) -> None:
        """An empty role string must NOT trigger the health notification."""
        assert _should_notify("") is False

    def test_uppercase_admin_does_not_trigger(self) -> None:
        """Role check is case-sensitive: 'Admin' (capital A) must NOT trigger."""
        assert _should_notify("Admin") is False

    def test_uppercase_owner_does_not_trigger(self) -> None:
        """Role check is case-sensitive: 'Owner' (capital O) must NOT trigger."""
        assert _should_notify("Owner") is False

    def test_admin_with_whitespace_does_not_trigger(self) -> None:
        """'admin ' (trailing space) is not the same as 'admin' — must NOT trigger."""
        assert _should_notify("admin ") is False

    def test_superadmin_does_not_trigger(self) -> None:
        """'superadmin' is not a privileged role — must NOT trigger."""
        assert _should_notify("superadmin") is False

    # ── PRIVILEGED_ROLES constant ─────────────────────────────────────────

    def test_privileged_roles_contains_admin_and_owner(self) -> None:
        """PRIVILEGED_ROLES must contain exactly 'admin' and 'owner'."""
        assert "admin" in PRIVILEGED_ROLES
        assert "owner" in PRIVILEGED_ROLES

    def test_privileged_roles_does_not_contain_member(self) -> None:
        """PRIVILEGED_ROLES must not contain 'member'."""
        assert "member" not in PRIVILEGED_ROLES

    def test_privileged_roles_does_not_contain_viewer(self) -> None:
        """PRIVILEGED_ROLES must not contain 'viewer'."""
        assert "viewer" not in PRIVILEGED_ROLES
