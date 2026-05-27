import { describe, expect, it } from 'vitest';
import { applyNavProfile, NAV_PROFILES } from '../navProfiles';
import type { NavSection } from '../../layouts/navigation';

const mockSections: NavSection[] = [
  { key: 'overview', label: 'Overview', zone: 'core-commerce', icon: null, items: [{ key: '/', label: 'Home', icon: null }] },
  { key: 'sales', label: 'Sales', zone: 'core-commerce', icon: null, items: [{ key: '/invoices', label: 'Invoices', icon: null }] },
  { key: 'accounting', label: 'Accounting', zone: 'finance-control', icon: null, items: [{ key: '/journals', label: 'Journals', icon: null }] },
  { key: 'setup', label: 'Setup', zone: 'finance-control', icon: null, items: [{ key: '/settings', label: 'Settings', icon: null }] },
];

describe('navProfiles', () => {
  it('filters sales cluster to sales-focused sections', () => {
    const result = applyNavProfile(mockSections, 'sales_cluster');
    expect(result.map((s) => s.key)).toEqual(['overview', 'sales', 'setup']);
  });

  it('readonly hides setup when not in profile', () => {
    const result = applyNavProfile(mockSections, 'readonly');
    expect(result.some((s) => s.key === 'setup')).toBe(false);
  });

  it('exposes config for every nav profile id', () => {
    for (const id of Object.keys(NAV_PROFILES)) {
      expect(NAV_PROFILES[id as keyof typeof NAV_PROFILES].sectionOrder.length).toBeGreaterThan(0);
    }
  });
});
