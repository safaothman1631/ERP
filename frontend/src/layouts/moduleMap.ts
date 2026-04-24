// Maps sidebar route paths → ModuleKey for onboarding visibility filtering.
// If a path isn't mapped, it's treated as always-visible (system/setup pages).
import type { ModuleKey } from '../onboarding/industries';

const PREFIX_MAP: Array<[string, ModuleKey]> = [
  // Sales
  ['/invoices', 'sales'],
  ['/quotes', 'sales'],
  ['/sales-orders', 'sales'],
  ['/credit-notes', 'sales'],
  ['/shipments', 'sales'],
  ['/delivery-challans', 'sales'],
  ['/sales-returns', 'sales'],
  ['/payment-links', 'sales'],
  ['/recurring-invoices', 'sales'],
  // Purchase
  ['/bills', 'purchase'],
  ['/purchase-orders', 'purchase'],
  ['/vendor-credits', 'purchase'],
  ['/purchase-returns', 'purchase'],
  ['/expenses', 'purchase'],
  ['/expense-claims', 'purchase'],
  // Inventory
  ['/inventory', 'inventory'],
  // Manufacturing
  ['/manufacturing', 'manufacturing'],
  // POS
  ['/pos', 'pos'],
  // CRM
  ['/crm', 'crm'],
  // HR + Payroll
  ['/hr', 'hr'],
  ['/payroll', 'hr'],
  // Projects + Assets
  ['/projects', 'projects'],
  ['/assets', 'assets'],
  // Banking
  ['/banking', 'banking'],
  // Accounting
  ['/accounts', 'accounting'],
  ['/journals', 'accounting'],
  ['/reports', 'accounting'],
  ['/tax-settings', 'accounting'],
  ['/tax-returns', 'accounting'],
  // Iraq L10n group
  ['/l10n-iq', 'l10n_iq'],
  ['/einvoice', 'einvoice'],
  ['/whatsapp', 'whatsapp'],
  ['/ocr', 'ocr'],
];

// Extended modules: /ext/<slug> → ext.<slug-with-underscores>
const EXT_SLUGS: ModuleKey[] = [
  'ext.helpdesk', 'ext.field_service', 'ext.subscriptions', 'ext.documents',
  'ext.knowledge', 'ext.livechat', 'ext.social', 'ext.comms', 'ext.engagement',
  'ext.elearning', 'ext.quality', 'ext.maintenance', 'ext.plm', 'ext.repairs',
  'ext.hr_extended', 'ext.studio', 'ext.rental', 'ext.ai', 'ext.mobile', 'ext.iot',
  'ext.healthcare', 'ext.hospital', 'ext.pharmacy', 'ext.hotel', 'ext.restaurant',
  'ext.construction', 'ext.real_estate', 'ext.education', 'ext.logistics',
  'ext.agriculture', 'ext.ngo', 'ext.government',
];

const moduleKeyToSlug = (k: ModuleKey): string => k.replace(/^ext\./, '').replace(/_/g, '-');
const EXT_PATH_MAP = new Map<string, ModuleKey>(EXT_SLUGS.map(k => [`/ext/${moduleKeyToSlug(k)}`, k]));

export const getModuleKeyForPath = (path: string): ModuleKey | null => {
  // /ext/<slug>
  if (path.startsWith('/ext/')) {
    const seg = '/ext/' + path.split('/')[2];
    return EXT_PATH_MAP.get(seg) ?? null;
  }
  for (const [prefix, mod] of PREFIX_MAP) {
    if (path === prefix || path.startsWith(prefix + '/')) return mod;
  }
  return null;
};
