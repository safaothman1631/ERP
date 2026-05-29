import { useMemo } from 'react';
import { useAuthStore } from '../../store';
import { readSessionClaims } from '../utils/sessionClaims';

export function usePlatformAccess() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const claims = useMemo(() => readSessionClaims(), [isAuthenticated]);

  const isSuperAdmin = claims.role === 'super_admin';
  const isPlatformAdmin = claims.isPlatformAdmin || isSuperAdmin;
  const canAccessPlatform = isAuthenticated && isPlatformAdmin;
  const isImpersonating = claims.isImpersonating;

  return {
    isSuperAdmin,
    isPlatformAdmin,
    canAccessPlatform,
    isImpersonating,
    role: claims.role,
  };
}
