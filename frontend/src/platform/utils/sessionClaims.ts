/** Decode JWT / localStorage session claims for platform gating. */

export interface SessionClaims {
  role: string | null;
  isPlatformAdmin: boolean;
  isImpersonating: boolean;
}

export function readSessionClaims(): SessionClaims {
  try {
    const role = localStorage.getItem('userRole');
    const isPlatformAdmin = localStorage.getItem('isPlatformAdmin') === 'true';
    const token = localStorage.getItem('token');
    if (!token) {
      return { role, isPlatformAdmin, isImpersonating: false };
    }
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { role, isPlatformAdmin, isImpersonating: false };
    }
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(payload));
    return {
      role: role || (typeof decoded.role === 'string' ? decoded.role : null),
      isPlatformAdmin: isPlatformAdmin || decoded.role === 'super_admin' || !!decoded.is_platform_admin,
      isImpersonating: !!decoded.impersonating,
    };
  } catch {
    return { role: null, isPlatformAdmin: false, isImpersonating: false };
  }
}

export function persistSessionClaims(role?: string, isPlatformAdmin?: boolean): void {
  if (role) localStorage.setItem('userRole', role);
  if (isPlatformAdmin != null) {
    localStorage.setItem('isPlatformAdmin', isPlatformAdmin ? 'true' : 'false');
  }
}
