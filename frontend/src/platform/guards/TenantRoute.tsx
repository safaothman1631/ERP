import { Navigate, Outlet } from 'react-router-dom';
import { usePlatformAccess } from '../hooks/usePlatformAccess';

/** Blocks super_admin from tenant shell unless impersonating. */
export default function TenantRoute() {
  const { isSuperAdmin, isImpersonating } = usePlatformAccess();
  if (isSuperAdmin && !isImpersonating) {
    return <Navigate to="/platform" replace />;
  }
  return <Outlet />;
}
