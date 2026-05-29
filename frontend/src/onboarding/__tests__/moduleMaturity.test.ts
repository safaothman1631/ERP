import { describe, expect, it } from 'vitest';
import { MODULES } from '../industries';
import {
  getMaturityBadge,
  getModuleMaturity,
  isScaffoldModule,
  MODULE_MATURITY,
  PRODUCTION_CORE_MODULES,
} from '../moduleMaturity';

describe('moduleMaturity', () => {
  it('assigns a maturity tier to every catalog module', () => {
    for (const mod of MODULES) {
      expect(MODULE_MATURITY[mod.key]).toBeDefined();
      expect(mod.maturity).toBe(MODULE_MATURITY[mod.key]);
    }
  });

  it('maps preview and scaffold tiers to nav badges', () => {
    expect(getMaturityBadge('preview')).toBe('Preview');
    expect(getMaturityBadge('scaffold')).toBe('Beta');
    expect(getMaturityBadge('production')).toBeNull();
    expect(getMaturityBadge('functional')).toBeNull();
  });

  it('defines production_core default modules for new tenants', () => {
    expect(PRODUCTION_CORE_MODULES).toEqual([
      'sales',
      'purchase',
      'inventory',
      'crm',
      'hr',
      'pos',
      'einvoice',
      'l10n_iq',
      'banking',
      'accounting',
    ]);
    expect(getModuleMaturity('sales')).toBe('production');
    expect(getModuleMaturity('einvoice')).toBe('preview');
    expect(isScaffoldModule('ext.helpdesk')).toBe(true);
    expect(isScaffoldModule('sales')).toBe(false);
  });
});
