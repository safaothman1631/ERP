import { describe, expect, it } from 'vitest';
import {
  DEMO_ROLES,
  getExpectedNavSections,
  ROLE_NAV_EXPECTATIONS,
  ROLE_SETUP_VISIBLE,
  SETUP_LEAVES,
} from '../roleAuditMatrix';

describe('roleAuditMatrix', () => {
  it('SETUP_LEAVES contains exactly 14 setup routes', () => {
    expect(SETUP_LEAVES).toHaveLength(14);
    expect(new Set(SETUP_LEAVES).size).toBe(14);
  });

  it('DEMO_ROLES matches the 12 seeded demo users', () => {
    expect(DEMO_ROLES).toHaveLength(12);
    expect(DEMO_ROLES).toContain('owner');
    expect(DEMO_ROLES).toContain('viewer');
  });

  describe('viewer', () => {
    it('ROLE_SETUP_VISIBLE is false', () => {
      expect(ROLE_SETUP_VISIBLE.viewer).toBe(false);
    });

    it('setup is not in expected nav sections', () => {
      expect(getExpectedNavSections('viewer')).not.toContain('setup');
      expect(ROLE_NAV_EXPECTATIONS.viewer).not.toContain('setup');
    });
  });

  describe('owner', () => {
    it('setup is visible', () => {
      expect(ROLE_SETUP_VISIBLE.owner).toBe(true);
      expect(getExpectedNavSections('owner')).toContain('setup');
    });
  });

  describe('sales_rep', () => {
    it('has setup and crm/sales sections', () => {
      const sections = getExpectedNavSections('sales_rep');
      expect(ROLE_SETUP_VISIBLE.sales_rep).toBe(true);
      expect(sections).toContain('setup');
      expect(sections).toContain('crm');
      expect(sections).toContain('sales');
    });
  });
});
