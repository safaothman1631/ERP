/** Indigo glass palette for platform console (distinct from tenant blue). */
export const platformPalette = {
  indigo: '#4f46e5',
  indigoLight: '#818cf8',
  violet: '#7c3aed',
  surfaceDark: '#0f0a1e',
  surfaceLight: '#f5f3ff',
};

export const platformNavItems = [
  { key: 'dashboard', path: '/platform', icon: 'dashboard' },
  { key: 'orgs', path: '/platform/orgs', icon: 'orgs' },
  { key: 'requests', path: '/platform/requests', icon: 'requests', badgeKey: 'pending_module_requests' as const },
  { key: 'users', path: '/platform/users', icon: 'users' },
  { key: 'audit', path: '/platform/audit', icon: 'audit' },
  { key: 'health', path: '/platform/health', icon: 'health' },
  { key: 'flags', path: '/platform/flags', icon: 'flags' },
  { key: 'announcements', path: '/platform/announcements', icon: 'announcements' },
] as const;
