import { describe, expect, it } from 'vitest';
import { getPostLoginPath, resolveRoleUx } from '../resolveRoleUx';

const t = (key: string, fallback?: string) => fallback ?? key;

describe('resolveRoleUx', () => {
  it('maps owner to executive theme with gold accent', () => {
    const ux = resolveRoleUx('owner', [], t);
    expect(ux.theme.id).toBe('executive');
    expect(ux.theme.isOwnerAccent).toBe(true);
    expect(ux.roleLabel).toBe('Owner');
  });

  it('maps sales role to sales theme', () => {
    const ux = resolveRoleUx('sales', [], t);
    expect(ux.theme.id).toBe('sales');
    expect(ux.theme.quickActions.length).toBeGreaterThan(0);
  });

  it('infers finance theme from permissions when role is unknown', () => {
    const ux = resolveRoleUx(null, ['settings.fiscal', 'accounts.budget'], t);
    expect(ux.theme.id).toBe('finance');
  });
});

describe('getPostLoginPath', () => {
  it('sends super_admin to platform console', () => {
    expect(getPostLoginPath('super_admin', [])).toBe('/platform');
  });

  it('sends POS cashier to POS terminal', () => {
    expect(getPostLoginPath('cashier', [])).toBe('/pos');
  });

  it('sends purchaser to purchase orders', () => {
    expect(getPostLoginPath('purchaser', [])).toBe('/purchase-orders');
  });

  it('sends sales to CRM leads', () => {
    expect(getPostLoginPath('sales', [])).toBe('/crm/leads');
  });

  it('defaults owner and viewer to dashboard', () => {
    expect(getPostLoginPath('owner', [])).toBe('/dashboard');
    expect(getPostLoginPath('viewer', [])).toBe('/dashboard');
  });
});
