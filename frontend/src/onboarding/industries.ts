// Industry presets + module catalogue used by the onboarding wizard.
// Each "module key" maps to one or more sidebar items in AppLayout.
// When enabledModules === null  → show everything (legacy users / not yet onboarded)
// When enabledModules is a Set  → filter sidebar to only those keys + always-on items.

import { MODULE_MATURITY, PRODUCTION_CORE_MODULES, type ModuleMaturityTier } from './moduleMaturity';

export type { ModuleMaturityTier } from './moduleMaturity';
export { PRODUCTION_CORE_MODULES } from './moduleMaturity';

export type ModuleKey =
  // ── core / ops ──
  | 'sales' | 'purchase' | 'inventory' | 'manufacturing'
  | 'projects' | 'assets' | 'pos'
  // ── finance ──
  | 'banking' | 'accounting'
  // ── people ──
  | 'crm' | 'hr'
  // ── system extras ──
  | 'einvoice' | 'whatsapp' | 'ocr' | 'l10n_iq'
  // ── extended (Wave A/B/C/D) — keyed by slug ──
  | 'ext.helpdesk' | 'ext.field_service' | 'ext.subscriptions'
  | 'ext.documents' | 'ext.knowledge' | 'ext.quality'
  | 'ext.maintenance' | 'ext.plm' | 'ext.repairs'
  | 'ext.hr_extended' | 'ext.studio'
  | 'ext.livechat' | 'ext.social' | 'ext.comms'
  | 'ext.engagement' | 'ext.elearning'
  | 'ext.rental' | 'ext.ai' | 'ext.mobile' | 'ext.iot'
  | 'ext.healthcare' | 'ext.hospital' | 'ext.pharmacy'
  | 'ext.hotel' | 'ext.restaurant'
  | 'ext.construction' | 'ext.real_estate'
  | 'ext.education' | 'ext.logistics' | 'ext.agriculture'
  | 'ext.ngo' | 'ext.government';

export interface ModuleDef {
  key: ModuleKey;
  labelKey: string;        // i18n key  (falls back to title)
  title: string;           // ku title
  category: 'core' | 'ops' | 'finance' | 'people' | 'system' | 'engagement' | 'platform' | 'vertical';
  icon: string;            // emoji for visual lightness in wizard
  description: string;
  maturity?: ModuleMaturityTier;
}

const MODULES_BASE: Omit<ModuleDef, 'maturity'>[] = [
  // core / ops
  { key: 'sales',         labelKey: 'mod_sales',         title: 'فرۆشتن',         category: 'ops',     icon: '🧾', description: 'فاکتور، quote، Sales Order، گەڕاندنەوە' },
  { key: 'purchase',      labelKey: 'mod_purchase',      title: 'کڕین',           category: 'ops',     icon: '📥', description: 'Bills، PO، Vendor Credits، خەرجی' },
  { key: 'inventory',     labelKey: 'mod_inventory',     title: 'کۆگا و کاڵا',   category: 'ops',     icon: '📦', description: 'بەرهەمەکان، Warehouse، جوڵەی کۆگا' },
  { key: 'manufacturing', labelKey: 'mod_manufacturing', title: 'بەرهەمهێنان',  category: 'ops',     icon: '🏭', description: 'BOM، Manufacturing Order، Work Center' },
  { key: 'projects',      labelKey: 'mod_projects',      title: 'پڕۆژەکان',     category: 'ops',     icon: '📋', description: 'پڕۆژە، تاسک، Timesheet' },
  { key: 'assets',        labelKey: 'mod_assets',        title: 'سامان',         category: 'ops',     icon: '🏛️', description: 'Fixed assets + بەرکەوتن' },
  { key: 'pos',           labelKey: 'mod_pos',           title: 'POS',            category: 'ops',     icon: '🛒', description: 'Point of Sale + Restaurant + Self-order' },

  // finance
  { key: 'banking',       labelKey: 'mod_banking',       title: 'بانک',           category: 'finance', icon: '🏦', description: 'هەژماری بانک، Reconciliation، Rules' },
  { key: 'accounting',    labelKey: 'mod_accounting',    title: 'ئەکاونتینگ',   category: 'finance', icon: '📊', description: 'COA، Journals، ڕاپۆرت، باج' },

  // people
  { key: 'crm',           labelKey: 'mod_crm',           title: 'CRM',            category: 'people',  icon: '🎯', description: 'Leads، Pipeline، Activities' },
  { key: 'hr',            labelKey: 'mod_hr',            title: 'HR',             category: 'people',  icon: '👔', description: 'کارمەند، گرێبەست، Attendance، Payroll' },

  // system extras
  { key: 'einvoice',      labelKey: 'mod_einvoice',      title: 'E-Invoice',      category: 'system',  icon: '📨', description: 'فاکتوری ئەلیکترۆنی' },
  { key: 'whatsapp',      labelKey: 'mod_whatsapp',      title: 'WhatsApp',       category: 'system',  icon: '💬', description: 'یەکگرتنی WhatsApp Business' },
  { key: 'ocr',           labelKey: 'mod_ocr',           title: 'OCR',            category: 'system',  icon: '📷', description: 'خوێندنەوەی پسولە بە AI' },
  { key: 'l10n_iq',       labelKey: 'mod_l10n_iq',       title: 'عێراق L10n',    category: 'system',  icon: '🇮🇶', description: 'WHT، VAT، COA عێراقی' },

  // extended — engagement
  { key: 'ext.helpdesk',     labelKey: 'mod_helpdesk_ext',  title: 'Helpdesk',           category: 'engagement', icon: '🎫', description: 'Tickets + SLA + CSAT' },
  { key: 'ext.field_service',labelKey: 'mod_fs_ext',        title: 'Field Service',     category: 'engagement', icon: '🔧', description: 'Workers + Service Orders + Dispatch' },
  { key: 'ext.subscriptions',labelKey: 'mod_subs_ext',      title: 'Subscriptions',     category: 'engagement', icon: '🔁', description: 'Plans + Recurring billing' },
  { key: 'ext.documents',    labelKey: 'mod_docs_ext',      title: 'Documents (DMS)',   category: 'engagement', icon: '📁', description: 'Folders + Files + Sign Requests' },
  { key: 'ext.knowledge',    labelKey: 'mod_kb_ext',        title: 'Knowledge / Wiki',  category: 'engagement', icon: '📚', description: 'Articles + Categories' },
  { key: 'ext.livechat',     labelKey: 'mod_livechat',      title: 'گفتوگۆی زیندوو',   category: 'engagement', icon: '💭', description: 'Channels + Bots + Canned' },
  { key: 'ext.social',       labelKey: 'mod_social',        title: 'سۆشیال میدیا',     category: 'engagement', icon: '📱', description: 'Posts + Mentions + Engagements' },
  { key: 'ext.comms',        labelKey: 'mod_comms',         title: 'SMS و VoIP',        category: 'engagement', icon: '☎️', description: 'SMS + Calls + Queues' },
  { key: 'ext.engagement',   labelKey: 'mod_engagement',    title: 'بۆنە و راپرسی',   category: 'engagement', icon: '🎉', description: 'Events + Surveys + Bookings' },
  { key: 'ext.elearning',    labelKey: 'mod_elearning',     title: 'فێرکاری ئۆنلاین',  category: 'engagement', icon: '🎓', description: 'Courses + Lessons + Certs' },

  // extended — quality / ops add-ons
  { key: 'ext.quality',      labelKey: 'mod_quality',       title: 'Quality',           category: 'ops',        icon: '✓',  description: 'Checks + Alerts + CAPA' },
  { key: 'ext.maintenance',  labelKey: 'mod_maintenance',   title: 'Maintenance',       category: 'ops',        icon: '🛠️', description: 'Equipment + Schedules' },
  { key: 'ext.plm',          labelKey: 'mod_plm',           title: 'PLM',                category: 'ops',        icon: '🧪', description: 'Product versions + ECOs' },
  { key: 'ext.repairs',      labelKey: 'mod_repairs',       title: 'Repairs',           category: 'ops',        icon: '🔩', description: 'Repair orders + Warranties' },
  { key: 'ext.hr_extended',  labelKey: 'mod_hr_ext',        title: 'HR Recruitment',    category: 'people',     icon: '🧑‍💼', description: 'Job positions + Candidates + Interviews' },
  { key: 'ext.studio',       labelKey: 'mod_studio',        title: 'Studio (no-code)',  category: 'platform',   icon: '🎨', description: 'Custom models + Views + Workflows' },

  // extended — platform
  { key: 'ext.rental',       labelKey: 'mod_rental',        title: 'کرێ',                category: 'platform',   icon: '📅', description: 'Rental products + Contracts' },
  { key: 'ext.ai',           labelKey: 'mod_ai',            title: 'AI Features',       category: 'platform',   icon: '🤖', description: 'Forecast + Anomaly + OCR' },
  { key: 'ext.mobile',       labelKey: 'mod_mobile',        title: 'مۆبایل API',        category: 'platform',   icon: '📲', description: 'Push + Sessions + Tokens' },
  { key: 'ext.iot',          labelKey: 'mod_iot',           title: 'IoT',                category: 'platform',   icon: '🌐', description: 'Devices + Readings + Alerts' },

  // extended — verticals
  { key: 'ext.healthcare',   labelKey: 'mod_healthcare',    title: 'تەندروستی',         category: 'vertical',   icon: '⚕️', description: 'نەخۆش + ژوان + ڕەچەتە' },
  { key: 'ext.hospital',     labelKey: 'mod_hospital',      title: 'نەخۆشخانە',        category: 'vertical',   icon: '🏥', description: 'Wards + Beds + Surgeries' },
  { key: 'ext.pharmacy',     labelKey: 'mod_pharmacy',      title: 'دەرمانخانە',       category: 'vertical',   icon: '💊', description: 'Drugs + Batches + Dispenses' },
  { key: 'ext.hotel',        labelKey: 'mod_hotel',         title: 'هۆتێل',              category: 'vertical',   icon: '🏨', description: 'Rooms + Reservations + Folios' },
  { key: 'ext.restaurant',   labelKey: 'mod_restaurant',    title: 'چێشتخانە',          category: 'vertical',   icon: '🍽️', description: 'Menu + Tables + KDS + Delivery' },
  { key: 'ext.construction', labelKey: 'mod_construction',  title: 'بنیاتنان',          category: 'vertical',   icon: '🏗️', description: 'Projects + WBS + Job Costs' },
  { key: 'ext.real_estate',  labelKey: 'mod_real_estate',   title: 'موڵک',                category: 'vertical',   icon: '🏘️', description: 'Properties + Units + Leases' },
  { key: 'ext.education',    labelKey: 'mod_education',     title: 'پەروەردە',          category: 'vertical',   icon: '🏫', description: 'Students + Classes + Grades + Fees' },
  { key: 'ext.logistics',    labelKey: 'mod_logistics',     title: 'لۆجستی',             category: 'vertical',   icon: '🚚', description: 'Shipments + Routes + Drivers' },
  { key: 'ext.agriculture',  labelKey: 'mod_agriculture',   title: 'کشتوکاڵ',           category: 'vertical',   icon: '🌾', description: 'Fields + Crops + Livestock' },
  { key: 'ext.ngo',          labelKey: 'mod_ngo',           title: 'NGO',                category: 'vertical',   icon: '🤝', description: 'Donors + Donations + Grants' },
  { key: 'ext.government',   labelKey: 'mod_government',    title: 'حکومی',              category: 'vertical',   icon: '🏛️', description: 'Citizens + Permits + Tenders' },
];

export const MODULES: ModuleDef[] = MODULES_BASE.map((m) => ({
  ...m,
  maturity: MODULE_MATURITY[m.key],
}));

/** Default module set for new tenants (production_core; accounting/banking are ALWAYS_ON). */
export const DEFAULT_NEW_TENANT_MODULES: ModuleKey[] = [...PRODUCTION_CORE_MODULES];

// Modules always enabled (essential foundation — user can't disable).
export const ALWAYS_ON: ModuleKey[] = ['accounting', 'banking'];

export interface IndustryPreset {
  id: string;
  title: string;            // ku title
  icon: string;
  description: string;
  modules: ModuleKey[];     // pre-selected modules
}

export const INDUSTRIES: IndustryPreset[] = [
  {
    id: 'production_core', title: 'Production Core (Default)', icon: '✅',
    description: 'Launch-certified modules for new Iraq SMB tenants',
    modules: [...PRODUCTION_CORE_MODULES],
  },
  {
    id: 'retail', title: 'بازرگانی گشتی / دوکان', icon: '🛍️',
    description: 'فرۆشگا، کۆگا، POS، ڕاپۆرتی فرۆشتن',
    modules: ['sales','purchase','inventory','crm','hr','pos','einvoice','l10n_iq'],
  },
  {
    id: 'restaurant', title: 'چێشتخانە / کەفێ', icon: '🍽️',
    description: 'POS، چێشتخانە، KDS، Delivery، کۆگای ماددە',
    modules: ['pos','inventory','hr','ext.restaurant','ext.engagement'],
  },
  {
    id: 'hotel', title: 'هۆتێل و میوانخانە', icon: '🏨',
    description: 'Reservation، Housekeeping، Folios، POS بۆ ڕێستۆرانتی هۆتێل',
    modules: ['hr','pos','ext.hotel','ext.engagement'],
  },
  {
    id: 'hospital', title: 'نەخۆشخانە / کلینیک', icon: '🏥',
    description: 'EMR، نەخۆش، نەشتەرگەری، تاقیگە، تیشک',
    modules: ['hr','ext.healthcare','ext.hospital','ext.pharmacy'],
  },
  {
    id: 'pharmacy', title: 'دەرمانخانە', icon: '💊',
    description: 'دەرمان، بەستە، بەسەرچوون، POS',
    modules: ['sales','inventory','pos','ext.pharmacy','ext.healthcare'],
  },
  {
    id: 'construction', title: 'بنیاتنان', icon: '🏗️',
    description: 'پڕۆژە، WBS، Job Costs، ئامێر، Subcontractor',
    modules: ['purchase','inventory','projects','hr','ext.construction'],
  },
  {
    id: 'real_estate', title: 'موڵک و کرێ', icon: '🏘️',
    description: 'یەکەکان، کرێچی، Lease، فاکتوری کرێ',
    modules: ['hr','ext.real_estate','ext.rental'],
  },
  {
    id: 'education', title: 'پەروەردە / قوتابخانە', icon: '🏫',
    description: 'قوتابی، پۆل، نمرە، کرێکانی قوتابخانە',
    modules: ['hr','ext.education','ext.elearning'],
  },
  {
    id: 'logistics', title: 'لۆجستی و گەیاندن', icon: '🚚',
    description: 'گەیاندن، ڕێگاکان، شۆفێر، GPS',
    modules: ['inventory','hr','ext.logistics'],
  },
  {
    id: 'agriculture', title: 'کشتوکاڵ', icon: '🌾',
    description: 'کێڵگە، چاندن، دروێنە، ئاژەڵ',
    modules: ['inventory','hr','ext.agriculture'],
  },
  {
    id: 'ngo', title: 'ڕێکخراوی ناحکومی', icon: '🤝',
    description: 'بەخشەران، گرانت، کامپەین، خۆبەخش',
    modules: ['hr','ext.ngo','ext.engagement'],
  },
  {
    id: 'government', title: 'حکومی', icon: '🏛️',
    description: 'هاوڵاتیان، خزمەتگوزاری، مۆڵەت، باج، مەزایدە',
    modules: ['hr','ext.government'],
  },
  {
    id: 'manufacturing', title: 'بەرهەمهێنان', icon: '🏭',
    description: 'BOM، Work Order، Quality، Maintenance، PLM',
    modules: ['sales','purchase','inventory','manufacturing','hr','ext.quality','ext.maintenance','ext.plm'],
  },
  {
    id: 'services', title: 'خزمەتگوزاری پڕۆفیشناڵ', icon: '💼',
    description: 'پڕۆژە، Timesheet، CRM، Helpdesk',
    modules: ['sales','crm','hr','projects','ext.helpdesk','ext.field_service'],
  },
  {
    id: 'subscription', title: 'SaaS / Subscription', icon: '🔁',
    description: 'پلانی مانگانە، فاکتوری دووبارە، CRM',
    modules: ['sales','crm','ext.subscriptions','ext.helpdesk','ext.knowledge'],
  },
  {
    id: 'custom', title: 'تایبەت — هەموو شت لاببە', icon: '⚙️',
    description: 'دەستی هەڵبژاردنی هەموو مۆدیولەکان',
    modules: [],
  },
];

export const getIndustry = (id: string) => INDUSTRIES.find(i => i.id === id);
