import { resolveRolePersona } from './rolePersonaRegistry';
import { resolveRoleTheme } from '../theme/roleThemes';
import type { RoleUxContext } from './types';

export function resolveRoleUx(
  role: string | null,
  permissions: string[],
  t: (key: string, fallback?: string) => string,
): RoleUxContext {
  const theme = resolveRoleTheme(role, permissions);
  const persona = resolveRolePersona(role);
  const roleLabel = t(persona.labelKey, persona.fallbackLabel);
  return { theme, persona, roleLabel };
}

export function getPostLoginPath(role: string | null, permissions: string[]): string {
  if (role === 'super_admin') return '/platform';
  return resolveRoleTheme(role, permissions).defaultRoute;
}
