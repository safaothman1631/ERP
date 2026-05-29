/**
 * usePermission — React hook for checking if the current user has a required role.
 *
 * Reads the user's role from the AuthStore (which is hydrated from localStorage
 * on load) and returns whether the user holds admin or owner privileges.
 *
 * The hook is intentionally synchronous — the role is already present in the
 * store after login, so no async fetch is needed for basic role checks.
 *
 * Usage:
 *   const { isAdmin, isOwner, hasSettingsAccess } = usePermission();
 *   if (!hasSettingsAccess) return <AccessDenied />;
 *
 * Requirements: 12.4, 12.5
 */
import { useAuthStore } from '../store';
import { readSessionClaims } from '../platform/utils/sessionClaims';

/** Roles that are allowed to view and modify application settings. */
export const SETTINGS_ALLOWED_ROLES: ReadonlyArray<string> = ['admin', 'owner', 'super_admin'];

export interface UsePermissionReturn {
  /** The raw role string from the auth store (e.g. "admin", "viewer"). */
  role: string | null;
  /** True when the user holds the "admin" role. */
  isAdmin: boolean;
  isSuperAdmin: boolean;
  /** True when the user holds the "owner" role. */
  isOwner: boolean;
  /** True when role is admin/owner inside tenant, or super_admin while impersonating. */
  isTenantOrgAdmin: boolean;
  /** True when JWT indicates platform impersonation session. */
  isImpersonating: boolean;
  /** Flat permissions list resolved from localStorage or token claims. */
  permissions: string[];
  /** Checks exact and wildcard permissions (e.g. settings.*). */
  hasPerm: (permission: string) => boolean;
  /**
   * True when the user is allowed to access the Settings page.
   * Requires admin or owner role (Requirement 12.4).
   */
  hasSettingsAccess: boolean;
  /** True when the user is authenticated at all. */
  isAuthenticated: boolean;
}

/**
 * Returns permission flags derived from the current user's role in AuthStore.
 *
 * The role is stored in the JWT payload and written to the user document in
 * Firestore. The frontend reads it from the store (hydrated from localStorage).
 *
 * Requirement 12.4 — Changes SHALL require appropriate permission (admin/owner).
 */
export function usePermission(): UsePermissionReturn {
  // Select only the fields we need to avoid unnecessary re-renders.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const claims = _extractSessionClaims();
  const platformClaims = readSessionClaims();

  // The role is derived from localStorage and JWT claims without extra API calls.
  const role = claims.role;
  const permissions = claims.permissions;
  const permissionSet = new Set(permissions);
  const isImpersonating = platformClaims.isImpersonating;

  const isAdmin = role === 'admin' || (role === 'super_admin' && isImpersonating);
  const isSuperAdmin = role === 'super_admin';
  const isOwner = role === 'owner';
  const isTenantOrgAdmin =
    role === 'admin' ||
    role === 'owner' ||
    (role === 'super_admin' && isImpersonating);
  const hasSettingsAccess = isAuthenticated && (isTenantOrgAdmin || isImpersonating);
  const hasPerm = (permission: string): boolean => {
    if (!isAuthenticated) return false;
    if (!permission) return true;
    // Platform permissions never granted via tenant org admin or wildcard *.
    if (permission.startsWith('platform.') && !isSuperAdmin) return false;
    if (isTenantOrgAdmin) return true;
    if (permissionSet.has('*') || permissionSet.has(permission)) return true;
    const [prefix] = permission.split('.');
    return permissionSet.has(`${prefix}.*`);
  };

  return {
    role,
    isAdmin,
    isSuperAdmin,
    isOwner,
    isTenantOrgAdmin,
    isImpersonating,
    permissions,
    hasPerm,
    hasSettingsAccess,
    isAuthenticated,
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Decode the JWT stored in localStorage and extract the `role` claim.
 *
 * Returns `null` when no token is present or the token cannot be decoded.
 * This is a client-side decode only — the backend always re-validates the
 * signature, so this is safe to use for UI gating.
 */
interface SessionClaims {
  role: string | null;
  permissions: string[];
}

function _readPermissionArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((value): value is string => typeof value === 'string' && value.length > 0);
    }
  } catch {
    // Fall through to plain text parsing.
  }
  return raw
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function _extractSessionClaims(): SessionClaims {
  try {
    const storedRole = localStorage.getItem('userRole');
    const storedPermissions = [
      ..._readPermissionArray(localStorage.getItem('userPermissions')),
      ..._readPermissionArray(localStorage.getItem('permissions')),
    ];

    const token = localStorage.getItem('token');
    if (!token) {
      return {
        role: storedRole || null,
        permissions: Array.from(new Set(storedPermissions)),
      };
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      return {
        role: storedRole || null,
        permissions: Array.from(new Set(storedPermissions)),
      };
    }

    // Base64url → base64 → JSON
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(payload));

    const role = typeof decoded.role === 'string' ? decoded.role : (storedRole || null);

    const tokenPerms: string[] = [];
    if (Array.isArray(decoded.permissions)) {
      tokenPerms.push(...decoded.permissions.filter((value: unknown): value is string => typeof value === 'string'));
    }
    if (Array.isArray(decoded.perms)) {
      tokenPerms.push(...decoded.perms.filter((value: unknown): value is string => typeof value === 'string'));
    }
    if (typeof decoded.scope === 'string') {
      tokenPerms.push(
        ...decoded.scope
          .split(/\s+/)
          .map((value: string) => value.trim())
          .filter(Boolean),
      );
    }

    return {
      role,
      permissions: Array.from(new Set([...storedPermissions, ...tokenPerms])),
    };
  } catch {
    return { role: null, permissions: [] };
  }
}
