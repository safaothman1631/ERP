import { describe, expect, it } from 'vitest';
import {
  bindingMatchesSpecialistScope,
  isSpecialistRole,
  normalizeSettingsRole,
  ROLE_MODULE_SCOPE,
} from '../roleModuleScope';
import { getBinding, getVisibleBindings } from '../moduleSettingsRegistry';

describe('roleModuleScope', () => {
  it('maps sales role to sales module', () => {
    expect(ROLE_MODULE_SCOPE.sales).toBe('sales');
    expect(isSpecialistRole('sales')).toBe(true);
    expect(isSpecialistRole('admin')).toBe(false);
  });

  it('normalizes legacy role aliases to canonical specialist roles', () => {
    expect(normalizeSettingsRole('sales_rep')).toBe('sales');
    expect(normalizeSettingsRole('inventory_manager')).toBe('inventory');
    expect(normalizeSettingsRole('cashier')).toBe('pos_cashier');
    expect(normalizeSettingsRole('pos_manager')).toBe('pos_cashier');
    expect(normalizeSettingsRole('hr_manager')).toBe('hr');
    expect(normalizeSettingsRole('warehouse')).toBe('inventory');
    expect(normalizeSettingsRole('admin')).toBe('admin');
  });

  it('treats alias roles as specialists', () => {
    expect(isSpecialistRole('sales_rep')).toBe(true);
    expect(isSpecialistRole('inventory_manager')).toBe(true);
    expect(isSpecialistRole('cashier')).toBe(true);
    expect(isSpecialistRole('hr')).toBe(true);
  });

  it('sales specialist matches sales section when module enabled', () => {
    const binding = getBinding('sales');
    expect(binding).toBeDefined();
    expect(bindingMatchesSpecialistScope('sales', binding!, ['sales', 'crm'])).toBe(true);
    expect(bindingMatchesSpecialistScope('sales', getBinding('crm')!, ['sales', 'crm'])).toBe(false);
  });

  it('purchaser matches purchases not sales', () => {
    expect(bindingMatchesSpecialistScope('purchaser', getBinding('purchases')!, ['purchase'])).toBe(true);
    expect(bindingMatchesSpecialistScope('purchaser', getBinding('sales')!, ['purchase', 'sales'])).toBe(false);
  });

  it('sales_rep sees sales scope when sales module enabled', () => {
    const visible = getVisibleBindings(['sales'], 'sales_rep', [], true);
    const keys = new Set(visible.map((binding) => binding.key));
    expect(keys.has('sales')).toBe(true);
    expect(keys.has('general')).toBe(false);
    expect(keys.has('profile')).toBe(true);
  });

  it('inventory_manager sees inventory tab', () => {
    const visible = getVisibleBindings(['inventory'], 'inventory_manager', [], true);
    const keys = new Set(visible.map((binding) => binding.key));
    expect(keys.has('inventory')).toBe(true);
    expect(keys.has('sales')).toBe(false);
  });

  it('cashier sees pos tab', () => {
    const visible = getVisibleBindings(['pos'], 'cashier', [], true);
    const keys = new Set(visible.map((binding) => binding.key));
    expect(keys.has('pos')).toBe(true);
    expect(keys.has('sales')).toBe(false);
  });

  it('hr sees hr tab when hr module enabled', () => {
    const visible = getVisibleBindings(['hr'], 'hr', [], true);
    const keys = new Set(visible.map((binding) => binding.key));
    expect(keys.has('hr')).toBe(true);
    expect(keys.has('general')).toBe(false);
  });
});
