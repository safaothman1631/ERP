import type { SectionKey } from './types';

export const PLATFORM_ONLY_KEYS: readonly SectionKey[] = ['feature_flags'];

export const PLATFORM_ONLY_ROUTES: readonly string[] = [
  '/settings/system-health',
  '/platform/feature-flags',
  '/platform/health',
  '/platform/orgs/:id/license',
  '/platform/module-requests',
  '/platform/users',
  '/platform/announcements',
];

export function isPlatformOnlySectionKey(key: string): boolean {
  return (PLATFORM_ONLY_KEYS as readonly string[]).includes(key);
}
