import type { ModuleKey } from './industries';

export type ModuleMaturityTier = 'production' | 'functional' | 'preview' | 'scaffold' | 'hidden';

/** Tier mapping per docs/ux/MODULE_MATURITY.md (tier4→production … tier1→scaffold). */
export const MODULE_MATURITY: Record<ModuleKey, ModuleMaturityTier> = {
  // production_core (tier 4)
  sales: 'production',
  purchase: 'production',
  inventory: 'production',
  pos: 'production',
  accounting: 'production',
  l10n_iq: 'production',

  // functional (tier 3)
  manufacturing: 'functional',
  projects: 'functional',
  assets: 'functional',
  banking: 'functional',
  crm: 'functional',
  hr: 'functional',
  'ext.subscriptions': 'functional',
  'ext.restaurant': 'functional',

  // preview (tier 2)
  einvoice: 'preview',
  whatsapp: 'preview',
  ocr: 'preview',
  'ext.ai': 'preview',

  // scaffold (tier 1)
  'ext.helpdesk': 'scaffold',
  'ext.field_service': 'scaffold',
  'ext.documents': 'scaffold',
  'ext.knowledge': 'scaffold',
  'ext.quality': 'scaffold',
  'ext.maintenance': 'scaffold',
  'ext.plm': 'scaffold',
  'ext.repairs': 'scaffold',
  'ext.hr_extended': 'scaffold',
  'ext.studio': 'scaffold',
  'ext.livechat': 'scaffold',
  'ext.social': 'scaffold',
  'ext.comms': 'scaffold',
  'ext.engagement': 'scaffold',
  'ext.elearning': 'scaffold',
  'ext.rental': 'scaffold',
  'ext.mobile': 'scaffold',
  'ext.iot': 'scaffold',
  'ext.healthcare': 'scaffold',
  'ext.hospital': 'scaffold',
  'ext.pharmacy': 'scaffold',
  'ext.hotel': 'scaffold',
  'ext.construction': 'scaffold',
  'ext.real_estate': 'scaffold',
  'ext.education': 'scaffold',
  'ext.logistics': 'scaffold',
  'ext.agriculture': 'scaffold',
  'ext.ngo': 'scaffold',
  'ext.government': 'scaffold',
};

/** Default modules enabled for new tenant onboarding (production_core). */
export const PRODUCTION_CORE_MODULES: ModuleKey[] = [
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
];

export const getModuleMaturity = (key: ModuleKey): ModuleMaturityTier =>
  MODULE_MATURITY[key] ?? 'hidden';

export const getMaturityBadge = (tier: ModuleMaturityTier): 'Preview' | 'Beta' | null => {
  if (tier === 'preview') return 'Preview';
  if (tier === 'scaffold') return 'Beta';
  return null;
};

export const isScaffoldModule = (key: ModuleKey): boolean =>
  getModuleMaturity(key) === 'scaffold';
