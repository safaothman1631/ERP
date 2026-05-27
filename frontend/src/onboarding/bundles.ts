/** License bundle presets — mirrors backend org_license.BUNDLES */
import type { ModuleKey } from './industries';
import { ALWAYS_ON } from './industries';

export type BundleId = 'pos_only' | 'trading' | 'full_core' | 'custom';

export interface BundleDef {
  id: BundleId;
  titleKey: string;
  title: string;
  description: string;
  modules: ModuleKey[];
}

const CORE: ModuleKey[] = [
  'sales', 'purchase', 'inventory', 'manufacturing', 'projects', 'assets', 'pos',
  'banking', 'accounting', 'crm', 'hr', 'einvoice', 'whatsapp', 'ocr', 'l10n_iq',
];

export const BUNDLES: BundleDef[] = [
  {
    id: 'pos_only',
    titleKey: 'bundle_pos_only',
    title: 'POS Retail',
    description: 'POS + Sales + Inventory + Accounting + Banking',
    modules: [...ALWAYS_ON, 'sales', 'inventory', 'pos'] as ModuleKey[],
  },
  {
    id: 'trading',
    titleKey: 'bundle_trading',
    title: 'Trading',
    description: 'Sales + Purchase + Inventory + CRM',
    modules: [...ALWAYS_ON, 'sales', 'purchase', 'inventory', 'crm'] as ModuleKey[],
  },
  {
    id: 'full_core',
    titleKey: 'bundle_full_core',
    title: 'Full Core ERP',
    description: 'All production core modules',
    modules: CORE,
  },
  {
    id: 'custom',
    titleKey: 'bundle_custom',
    title: 'Custom',
    description: 'Vendor-defined module pool',
    modules: [],
  },
];

export const bundleById = (id: BundleId | string | null | undefined): BundleDef | undefined =>
  BUNDLES.find(b => b.id === id);
