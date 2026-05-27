import { describe, expect, it } from 'vitest';
import { resolveRoleTheme, resolveRoleThemeId, ROLE_THEMES } from '../roleThemes';
import type { RoleThemeId } from '../../personas/types';

const THEME_IDS: RoleThemeId[] = [
  'executive', 'administrator', 'manager', 'finance', 'sales', 'purchase',
  'inventory', 'pos', 'hr', 'projects', 'personal', 'readonly',
];

describe('roleThemes', () => {
  it('exposes accent for every theme id', () => {
    for (const id of THEME_IDS) {
      expect(ROLE_THEMES[id].accent).toMatch(/^#/);
    }
  });

  it('maps role codes to expected theme ids', () => {
    expect(resolveRoleThemeId('owner', [])).toBe('executive');
    expect(resolveRoleThemeId('admin', [])).toBe('administrator');
    expect(resolveRoleThemeId('viewer', [])).toBe('readonly');
    expect(resolveRoleThemeId('inventory_manager', [])).toBe('inventory');
  });

  it('returns quick actions on executive theme', () => {
    const theme = resolveRoleTheme('owner', []);
    expect(theme.navProfile).toBe('full_admin');
    expect(theme.quickActions.some((a) => a.id === 'settings')).toBe(true);
  });

  it('readonly theme has no quick actions', () => {
    const theme = resolveRoleTheme('viewer', []);
    expect(theme.id).toBe('readonly');
    expect(theme.quickActions).toHaveLength(0);
  });
});
