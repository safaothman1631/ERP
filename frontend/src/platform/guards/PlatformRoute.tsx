import { Navigate } from 'react-router-dom';
import { usePlatformAccess } from '../hooks/usePlatformAccess';

interface PlatformRouteProps {
  children: React.ReactNode;
}

export default function PlatformRoute({ children }: PlatformRouteProps) {
  const { canAccessPlatform } = usePlatformAccess();
  if (!canAccessPlatform) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
