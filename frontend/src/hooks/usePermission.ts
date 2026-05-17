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

/** Roles that are allowed to view and modify application settings. */
export const SETTINGS_ALLOWED_ROLES: ReadonlyArray<string> = ['admin', 'owner'];

export interface UsePermissionReturn {
  /** The raw role string from the auth store (e.g. "admin", "viewer"). */
  role: string | null;
  /** True when the user holds the "admin" role. */
  isAdmin: boolean;
  /** True when the user holds the "owner" role. */
  isOwner: boolean;
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
  const userId = useAuthStore((s) => s.userId);

  // The role is not currently stored in the AuthStore state directly.
  // We derive it from the JWT stored in localStorage so we don't need an
  // extra API call. The JWT payload is base64url-encoded and safe to decode
  // client-side (we are not trusting it for security — the backend validates
  // the signature on every request).
  const role = _extractRoleFromToken();

  const isAdmin = role === 'admin';
  const isOwner = role === 'owner';
  const hasSettingsAccess = isAuthenticated && (isAdmin || isOwner);

  return { role, isAdmin, isOwner, hasSettingsAccess, isAuthenticated };
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
function _extractRoleFromToken(): string | null {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Base64url → base64 → JSON
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(payload));
    return typeof decoded.role === 'string' ? decoded.role : null;
  } catch {
    return null;
  }
}
