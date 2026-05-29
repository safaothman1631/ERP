/** Post-login redirect based on role and permissions. */
import { getPostLoginPath } from '../../personas/resolveRoleUx';

export function postLoginPath(role?: string, isPlatformAdmin?: boolean, permissions: string[] = []): string {
  if (role === 'super_admin' || isPlatformAdmin) return '/platform';
  return getPostLoginPath(role ?? null, permissions);
}
