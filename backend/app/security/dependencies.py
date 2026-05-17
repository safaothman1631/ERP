"""
FastAPI security dependencies for the ERP backend.

Provides:
  - get_current_user(): resolves and validates the JWT bearer token
  - require_permission(): dependency factory for RBAC enforcement
  - get_optional_user(): non-raising variant for public/semi-public endpoints

Requirements: 6.1, 6.2, 6.3, 6.4, 14.1, 14.4
"""
from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.security.permissions import user_has_perm

# Re-export get_current_user from services.auth so all code can import from
# either location.  The canonical implementation lives in services/auth.py.
from app.services.auth import get_current_user  # noqa: F401

# OAuth2 bearer scheme — used by optional user dependency
_oauth2_scheme_optional = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login",
    auto_error=False,  # don't raise 401 automatically
)


def get_optional_user(
    token: Optional[str] = Depends(_oauth2_scheme_optional),
) -> Optional[dict]:
    """FastAPI dependency: return the current user or None for unauthenticated requests.

    Unlike ``get_current_user``, this dependency does NOT raise 401 when no
    token is present.  Useful for endpoints that behave differently for
    authenticated vs. anonymous users (e.g. public storefront).

    Args:
        token: Optional Bearer token from the Authorization header.

    Returns:
        User dict if a valid token is provided, None otherwise.
    """
    if not token:
        return None
    try:
        from app.services.auth import get_current_user as _get_user
        from fastapi.security import OAuth2PasswordBearer as _OA
        # Manually call the auth service with the token
        return _get_user(token=token)
    except HTTPException:
        return None
    except Exception:
        return None


def require_permission(resource: str, action: str):
    """FastAPI dependency factory: enforce RBAC permission for resource+action.

    Usage::

        @router.post("/api/v1/invoices")
        async def create_invoice(
            payload: InvoiceCreate,
            current_user: dict = Depends(get_current_user),
            _: None = Depends(require_permission("invoices", "create")),
        ):
            ...

    Args:
        resource: The resource/module being accessed (e.g. 'invoices').
        action: The action being performed (e.g. 'create', 'read').

    Returns:
        A FastAPI dependency function that raises HTTP 403 if the user lacks
        the required permission.

    Requirements: 14.1, 14.4
    """
    permission_code = f"{resource}.{action}"

    def _check(user: dict = Depends(get_current_user)) -> dict:
        if not user_has_perm(user, permission_code):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"دەسەڵات نییە: {permission_code}",
            )
        return user

    return _check


def require_any_permission(*permission_codes: str):
    """FastAPI dependency: pass if the user has ANY of the given permissions.

    Useful for endpoints accessible by multiple roles with different permissions.

    Args:
        *permission_codes: One or more permission codes (e.g. 'invoices.read', 'reports.export').

    Returns:
        A FastAPI dependency function that raises HTTP 403 if the user has
        none of the required permissions.
    """
    def _check(user: dict = Depends(get_current_user)) -> dict:
        for code in permission_codes:
            if user_has_perm(user, code):
                return user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"دەسەڵات نییە: {' یان '.join(permission_codes)}",
        )

    return _check


def require_org_admin():
    """FastAPI dependency: require the user to be an org admin or super_admin.

    Returns:
        A FastAPI dependency function that raises HTTP 403 for non-admin users.
    """
    def _check(user: dict = Depends(get_current_user)) -> dict:
        role = user.get("role", "")
        if role not in ("admin", "super_admin"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="ئەم کردارە تەنها بۆ بەڕێوەبەران بەردەستە",
            )
        return user

    return _check
