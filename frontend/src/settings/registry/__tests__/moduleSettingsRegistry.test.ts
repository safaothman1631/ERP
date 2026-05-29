import { describe, expect, it } from 'vitest';
import {
  SECTION_BINDINGS,
  MODULE_PRIMARY_SECTION,
  canEditBinding,
  getBinding,
  getSectionsForModule,
  getVisibleBindings,
} from '../moduleSettingsRegistry';

describe('moduleSettingsRegistry', () => {
  it('includes catalog sections from requirement 4', () => {
    const keys = new Set(SECTION_BINDINGS.map((binding) => binding.key));
    expect(keys.has('profile')).toBe(true);
    expect(keys.has('sales')).toBe(true);
    expect(keys.has('modules')).toBe(true);
    expect(keys.has('feature_flags')).toBe(true);
  });

  it('maps module primary sections for deep-linking', () => {
    expect(MODULE_PRIMARY_SECTION.sales).toBe('sales');
    expect(MODULE_PRIMARY_SECTION.purchase).toBe('purchases');
    expect(MODULE_PRIMARY_SECTION['ext.subscriptions']).toBe('ecommerce');
  });

  it('resolves a section binding by key', () => {
    const binding = getBinding('numbering');
    expect(binding).toBeDefined();
    expect(binding?.route).toBe('/settings/numbering');
    expect(binding?.permission).toBe('settings.numbering');
  });

  it('returns all sections that are gated by a module', () => {
    const sectionKeys = getSectionsForModule('sales').map((binding) => binding.key);
    expect(sectionKeys).toContain('sales');
    expect(sectionKeys).toContain('payment_methods');
    expect(sectionKeys).toContain('templates');
  });

  it('hides platform-only sections in tenant mode', () => {
    const visible = getVisibleBindings(['sales'], 'admin', ['settings.update'], true);
    expect(visible.some((binding) => binding.key === 'feature_flags')).toBe(false);
  });

  it('shows platform-only sections outside tenant mode with platform permissions', () => {
    const visible = getVisibleBindings(['sales'], 'super_admin', ['platform.admin'], false);
    expect(visible.some((binding) => binding.key === 'feature_flags')).toBe(true);
  });

  it('applies module gating and keeps always-on finance modules available', () => {
    const visible = getVisibleBindings([], 'manager', ['settings.read'], true);
    const keys = new Set(visible.map((binding) => binding.key));
    expect(keys.has('sales')).toBe(false);
    expect(keys.has('fiscal')).toBe(true);
    expect(keys.has('banking')).toBe(true);
  });

  it('restricts viewer role to personal tier by default', () => {
    const visible = getVisibleBindings(['sales'], 'viewer', [], true);
    const keys = new Set(visible.map((binding) => binding.key));
    expect(keys.has('profile')).toBe(true);
    expect(keys.has('system')).toBe(true);
    expect(keys.has('modules')).toBe(true);
    expect(keys.has('general')).toBe(false);
    expect(keys.has('sales')).toBe(false);
  });

  it('allows manager read visibility for org sections without edit', () => {
    const salesBinding = getBinding('sales');
    expect(salesBinding).toBeDefined();
    const visible = getVisibleBindings(['sales'], 'manager', [], true);
    expect(visible.some((binding) => binding.key === 'sales')).toBe(true);
    expect(canEditBinding(salesBinding!, 'manager', [])).toBe(false);
  });

  it('allows specific write permission without admin role', () => {
    const fiscalBinding = getBinding('fiscal');
    expect(fiscalBinding).toBeDefined();
    const visible = getVisibleBindings(['accounting'], 'accountant', ['settings.fiscal'], true);
    expect(visible.some((binding) => binding.key === 'fiscal')).toBe(true);
    expect(canEditBinding(fiscalBinding!, 'accountant', ['settings.fiscal'])).toBe(true);
  });

  it('sales specialist sees sales settings only when crm also enabled', () => {
    const visible = getVisibleBindings(['sales', 'crm'], 'sales', [], true);
    const keys = new Set(visible.map((binding) => binding.key));
    expect(keys.has('sales')).toBe(true);
    expect(keys.has('crm')).toBe(false);
    expect(keys.has('general')).toBe(false);
  });
});
