"""Platform admin API — vendor console."""
from __future__ import annotations

from fastapi import APIRouter

from . import (
    announcements,
    audit,
    feature_flags,
    health,
    impersonate,
    licenses,
    module_requests,
    orgs,
    stats,
    usage,
    users,
)

router = APIRouter(prefix="/api/platform", tags=["Platform"])

router.include_router(stats.router)
router.include_router(orgs.router)
router.include_router(licenses.router)
router.include_router(module_requests.router)
router.include_router(users.router)
router.include_router(impersonate.router)
router.include_router(audit.router)
router.include_router(feature_flags.router)
router.include_router(announcements.router)
router.include_router(health.router)
router.include_router(usage.router)

# Backward compat for tests importing from app.api.platform
from app.firestore.organizations import OrganizationRepository  # noqa: E402
from app.services.org_license import set_org_license  # noqa: E402
from app.services.permissions import user_has_perm  # noqa: E402

from ._guards import require_platform_admin, require_super_admin, _platform_admin_ids  # noqa: E402
from ._audit import audit_platform as _audit_platform  # noqa: E402
from .licenses import LicenseUpdatePayload, update_org_license, get_org_license, list_bundles  # noqa: E402

__all__ = [
    "router",
    "require_platform_admin",
    "require_super_admin",
    "_platform_admin_ids",
    "_audit_platform",
    "LicenseUpdatePayload",
    "update_org_license",
    "get_org_license",
    "list_bundles",
    "OrganizationRepository",
    "set_org_license",
    "user_has_perm",
]
