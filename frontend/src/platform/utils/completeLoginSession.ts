import { useAuthStore } from '../../store';
import { persistSessionClaims } from './sessionClaims';
import { postLoginPath } from './postLoginPath';

export interface AuthTokenResponse {
  access_token: string;
  user_id: string;
  org_id: string;
  user_name: string;
  role?: string;
  is_platform_admin?: boolean;
  requires_2fa_setup?: boolean;
}

/** Apply login response to store + localStorage and return redirect path. */
export function completeLoginSession(res: AuthTokenResponse): string {
  const { login } = useAuthStore.getState();
  login(
    res.access_token,
    res.user_id,
    res.org_id,
    res.user_name,
    res.role,
  );
  persistSessionClaims(res.role, res.is_platform_admin ?? res.role === 'super_admin');
  if (res.requires_2fa_setup) {
    return '/settings?s=security';
  }
  return postLoginPath(res.role, res.is_platform_admin);
}
