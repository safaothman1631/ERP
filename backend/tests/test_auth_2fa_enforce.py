"""Phase 2: 2FA enforcement for privileged roles."""
from app.schemas.schemas import LoginRequest
from app.services.two_factor_policy import (
    PRIVILEGED_2FA_ROLES,
    user_must_keep_2fa,
    user_requires_2fa_setup,
)


def test_login_request_accepts_totp_code():
    req = LoginRequest(email="admin@test.com", password="secret", totp_code="123456")
    assert req.totp_code == "123456"


def test_privileged_roles_set():
    assert "admin" in PRIVILEGED_2FA_ROLES
    assert "accountant" in PRIVILEGED_2FA_ROLES
    assert "super_admin" in PRIVILEGED_2FA_ROLES


def test_security_settings_default_requires_2fa_admin():
    from app.services.settings_service import get_security_settings
    defaults = get_security_settings("__default_org__")
    assert defaults.get("require_2fa_for_admin") is True


def test_user_requires_2fa_setup_when_privileged_and_not_enabled():
    user = {"role": "admin", "org_id": "org-1", "is_2fa_enabled": False}
    assert user_requires_2fa_setup(user) is True


def test_user_requires_2fa_setup_false_when_enabled():
    user = {"role": "admin", "org_id": "org-1", "is_2fa_enabled": True}
    assert user_requires_2fa_setup(user) is False


def test_user_requires_2fa_setup_false_for_sales_rep():
    user = {"role": "sales_rep", "org_id": "org-1", "is_2fa_enabled": False}
    assert user_requires_2fa_setup(user) is False


def test_user_must_keep_2fa_when_enabled_and_privileged():
    user = {"role": "owner", "org_id": "org-1", "is_2fa_enabled": True}
    assert user_must_keep_2fa(user) is True
