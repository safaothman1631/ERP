"""2FA policy: never mandatory, daily reminder when off.

Policy decision (2026-05-27): no role requires 2FA. The legacy enforcement
helpers now always return False; a new ``user_should_remind_2fa`` helper
drives the daily reminder banner. The privileged-role set is retained as
metadata only.
"""
from app.schemas.schemas import LoginRequest
from app.services.two_factor_policy import (
    PRIVILEGED_2FA_ROLES,
    org_requires_2fa_for_privileged,
    user_must_keep_2fa,
    user_requires_2fa_setup,
    user_should_remind_2fa,
)


def test_login_request_accepts_totp_code():
    req = LoginRequest(email="admin@test.com", password="secret", totp_code="123456")
    assert req.totp_code == "123456"


def test_privileged_roles_set_kept_as_metadata():
    # The set is still exposed so other code can show role-specific copy,
    # but it no longer controls enforcement.
    assert "admin" in PRIVILEGED_2FA_ROLES
    assert "accountant" in PRIVILEGED_2FA_ROLES
    assert "super_admin" in PRIVILEGED_2FA_ROLES


def test_security_settings_default_does_not_require_2fa():
    from app.services.settings_service import get_security_settings
    defaults = get_security_settings("__default_org__")
    # Advisory flag, defaults to False — never mandates 2FA.
    assert defaults.get("require_2fa_for_admin") is False


def test_org_never_requires_2fa_for_privileged():
    assert org_requires_2fa_for_privileged("any-org") is False


def test_user_requires_2fa_setup_always_false():
    # Even for privileged role with 2FA disabled, setup is not required.
    user = {"role": "admin", "org_id": "org-1", "is_2fa_enabled": False}
    assert user_requires_2fa_setup(user) is False


def test_user_must_keep_2fa_always_false():
    # Even with 2FA on, the user is allowed to disable it.
    user = {"role": "owner", "org_id": "org-1", "is_2fa_enabled": True}
    assert user_must_keep_2fa(user) is False


def test_user_should_remind_2fa_when_disabled():
    user = {"role": "sales_rep", "org_id": "org-1", "is_2fa_enabled": False}
    assert user_should_remind_2fa(user) is True


def test_user_should_not_remind_when_enabled():
    user = {"role": "admin", "org_id": "org-1", "is_2fa_enabled": True}
    assert user_should_remind_2fa(user) is False


def test_user_should_remind_for_any_role():
    # Reminder fires regardless of role, since the policy applies to all users.
    for role in ("admin", "viewer", "sales_rep", "accountant"):
        user = {"role": role, "org_id": "org-1", "is_2fa_enabled": False}
        assert user_should_remind_2fa(user) is True, f"expected reminder for {role}"
