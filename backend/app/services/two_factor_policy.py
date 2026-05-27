"""Org policy helpers for 2FA.

Policy decision (2026-05-27): 2FA is NEVER mandatory on any role. The app
must remind users daily when 2FA is disabled, but it must never block
login, navigation, or disabling. The helpers below are kept as the single
source of truth so both backend and frontend can read a consistent answer.
"""
from __future__ import annotations

# Kept only as documentation / metadata for the reminder banner. These are
# the roles for whom 2FA is *strongly recommended*; they are NOT enforced.
PRIVILEGED_2FA_ROLES = frozenset({
    "admin",
    "owner",
    "super_admin",
    "accountant",
    "accounting_manager",
})


def org_requires_2fa_for_privileged(org_id: str) -> bool:
    """Always False — org policy can no longer mandate 2FA.

    Kept for backward compatibility with callers; the org setting
    ``require_2fa_for_admin`` is now treated as advisory only.
    """
    return False


def user_requires_2fa_setup(user: dict) -> bool:  # noqa: ARG001
    """Always False — 2FA setup is never required to use the app."""
    return False


def user_must_keep_2fa(user: dict) -> bool:  # noqa: ARG001
    """Always False — users can disable 2FA at any time."""
    return False


def user_should_remind_2fa(user: dict) -> bool:
    """True when the user does NOT have 2FA enabled.

    The frontend uses this to display a once-per-day dismissible banner.
    Returns False as soon as ``is_2fa_enabled`` flips to True.
    """
    return not bool(user.get("is_2fa_enabled"))
