import { NAV_PROFILES } from '../personas/navProfiles';
import { resolveRoleTheme } from '../theme/roleThemes';

/** 14 setup leaf routes from the navigation setup section (Req 2.1). */
export const SETUP_LEAVES = [
  '/custom-fields',
  '/users',
  '/rbac-roles',
  '/user-roles',
  '/settings',
  '/settings/numbering',
  '/automation-rules',
  '/audit-log-viewer',
  '/admin/job-runs',
  '/studio',
  '/onboarding',
  '/docs',
  '/ui-gallery',
  '/trash',
] as const;

/** Demo JWT role codes seeded by `backend/scripts/seed_role_demo_users.py`. */
export const DEMO_ROLES = [
  'owner',
  'admin',
  'manager',
  'accountant',
  'sales_rep',
  'purchaser',
  'inventory_manager',
  'cashier',
  'hr',
  'project_manager',
  'viewer',
  'user',
] as const;

export type DemoRole = (typeof DEMO_ROLES)[number];

/** Expected nav section keys per demo role (sectionOrder + optionalSections from nav profile). */
export function getExpectedNavSections(role: string): string[] {
  const { navProfile } = resolveRoleTheme(role, []);
  const config = NAV_PROFILES[navProfile] ?? NAV_PROFILES.full_admin;
  return [...config.sectionOrder, ...(config.optionalSections ?? [])];
}

export const ROLE_NAV_EXPECTATIONS: Record<string, string[]> = Object.fromEntries(
  DEMO_ROLES.map((role) => [role, getExpectedNavSections(role)]),
);

export const ROLE_SETUP_VISIBLE: Record<string, boolean> = Object.fromEntries(
  DEMO_ROLES.map((role) => [role, ROLE_NAV_EXPECTATIONS[role].includes('setup')]),
);
