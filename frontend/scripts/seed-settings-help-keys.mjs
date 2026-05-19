#!/usr/bin/env node
/**
 * Seed Settings Help_Content translation keys for the umbrella spec
 * `system-wide-ux-overhaul` task 6.3.
 *
 * For every Settings sub-section enumerated in `frontend/src/help/registry.ts`,
 * this script ensures `en.json` and `ku.json` carry:
 *   - `settings.help.<key>.what`
 *   - `settings.help.<key>.why`
 *   - `settings.help.<key>.step_<n>`         (n = 1..stepCount)
 *   - `settings.help.<key>.relates_to.<i>.label`  (i = 0..relatesTo-1)
 *
 * Existing values are preserved verbatim — this script never overwrites a
 * non-empty translation. The canonical text owner is the
 * `settings-documentation` sibling spec; this seeder only guarantees the
 * keys exist with a usable English / Kurdish placeholder so the umbrella's
 * rendering surface (`useHelp`, `HelpPanel`, `HelpIcon`) does not encounter
 * missing-key fallbacks at runtime.
 *
 * Idempotent: running twice produces no diff after the first run.
 *
 * _Validates: Requirements 7.1, 7.3, 7.4, 11.5, 12.6, 17.1_
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repo = path.resolve(dirname, '..');
const enPath = path.join(repo, 'src', 'locales', 'en.json');
const kuPath = path.join(repo, 'src', 'locales', 'ku.json');

// ─────────────────────────────────────────────────────────────────────────
// Section metadata — must stay in sync with `frontend/src/help/registry.ts`.
//
// The shape is { humanLabelEn, humanLabelKu, relatesTo: [{ key, route }] }
// where each `relatesTo[i]` describes the linked Section in the order the
// registry lists them. The label is rendered as the link's visible text.
//
// Step count is fixed at 3 for all Settings entries (the registry seed default)
// except for entries that already carry more steps in the locale files; for
// those we keep the existing extra steps untouched and only fill the first 3.
// ─────────────────────────────────────────────────────────────────────────

const STEPS_PER_SETTINGS = 3;

/**
 * Settings sub-section catalog. Each entry is keyed by the SectionId suffix
 * (e.g. `currencies` from `settings.currencies`) and carries:
 *   - en / ku display name (used in placeholders)
 *   - relatesTo: [{ en, ku }] — labels for the registry's `relatesTo` slots
 *
 * Order of relatesTo MUST match `helpRegistry` in `registry.ts`.
 */
const SETTINGS = {
  // Account & personal
  profile:        { en: 'Profile',              ku: 'پرۆفایل',             relatesTo: [
    { en: 'Security',                    ku: 'پاراستن' },
    { en: 'Notifications',               ku: 'ئاگادارکردنەوەکان' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},
  security:       { en: 'Security',             ku: 'پاراستن',             relatesTo: [
    { en: 'Profile',                     ku: 'پرۆفایل' },
    { en: 'Single sign-on (SSO)',        ku: 'چوونەژوورەوەی یەکجارە (SSO)' },
    { en: 'Login page',                  ku: 'پەڕەی چوونەژوورەوە' },
  ]},
  notifications:  { en: 'Notifications',        ku: 'ئاگادارکردنەوەکان',   relatesTo: [
    { en: 'Email settings',              ku: 'ڕێکخستنەکانی ئیمێل' },
    { en: 'SMS / WhatsApp',              ku: 'SMS / واتساپ' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},
  preferences:    { en: 'Preferences',          ku: 'هەڵبژاردنەکان',       relatesTo: [
    { en: 'Appearance',                  ku: 'دیمەن' },
    { en: 'Localization',                ku: 'شوێنایەتی' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},

  // General & appearance
  general:        { en: 'General',              ku: 'گشتی',                relatesTo: [
    { en: 'Organization profile',        ku: 'پرۆفایلی ڕێکخراو' },
    { en: 'Localization',                ku: 'شوێنایەتی' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},
  appearance:     { en: 'Appearance',           ku: 'دیمەن',               relatesTo: [
    { en: 'Branding',                    ku: 'برانڈینگ' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},
  feature_flags:  { en: 'Feature flags',        ku: 'ئاڵای تایبەتمەندی',   relatesTo: [
    { en: 'Modules',                     ku: 'مۆدێڵەکان' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},

  // Organization
  organization:   { en: 'Organization',         ku: 'ڕێکخراو',             relatesTo: [
    { en: 'Branches',                    ku: 'لقەکان' },
    { en: 'Branding',                    ku: 'برانڈینگ' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},
  branches:       { en: 'Branches',             ku: 'لقەکان',              relatesTo: [
    { en: 'Organization profile',        ku: 'پرۆفایلی ڕێکخراو' },
    { en: 'Warehouses',                  ku: 'کۆگاکان' },
  ]},
  branding:       { en: 'Branding',             ku: 'برانڈینگ',            relatesTo: [
    { en: 'Document templates',          ku: 'قاڵبەکانی بەڵگە' },
    { en: 'Invoices',                    ku: 'پسووڵەکان' },
  ]},
  working_hours:  { en: 'Working hours',        ku: 'کاتژمێرەکانی کار',    relatesTo: [
    { en: 'Holidays',                    ku: 'پشوو پێدان' },
    { en: 'Human resources',             ku: 'سەرچاوە مرۆییەکان' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},
  holidays:       { en: 'Holidays',             ku: 'پشوو پێدان',          relatesTo: [
    { en: 'Working hours',               ku: 'کاتژمێرەکانی کار' },
    { en: 'Human resources',             ku: 'سەرچاوە مرۆییەکان' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},

  // Users & access
  users:          { en: 'Users',                ku: 'بەکارهێنەران',        relatesTo: [
    { en: 'Roles',                       ku: 'دەسەڵاتەکان' },
    { en: 'Permissions',                 ku: 'ڕێگەپێدانەکان' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},
  roles:          { en: 'Roles',                ku: 'دەسەڵاتەکان',         relatesTo: [
    { en: 'Users',                       ku: 'بەکارهێنەران' },
    { en: 'Permissions',                 ku: 'ڕێگەپێدانەکان' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},
  permissions:    { en: 'Permissions',          ku: 'ڕێگەپێدانەکان',       relatesTo: [
    { en: 'Roles',                       ku: 'دەسەڵاتەکان' },
    { en: 'Users',                       ku: 'بەکارهێنەران' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},
  sso:            { en: 'Single sign-on',       ku: 'چوونەژوورەوەی یەکجارە', relatesTo: [
    { en: 'Security',                    ku: 'پاراستن' },
    { en: 'Users',                       ku: 'بەکارهێنەران' },
    { en: 'Login page',                  ku: 'پەڕەی چوونەژوورەوە' },
  ]},
  portals:        { en: 'Customer & vendor portals', ku: 'پۆرتاڵی کڕیار و فرۆشیار', relatesTo: [
    { en: 'Customer portal',             ku: 'پۆرتاڵی کڕیار' },
    { en: 'Vendor portal',               ku: 'پۆرتاڵی فرۆشیار' },
  ]},

  // Localization
  localization:   { en: 'Localization',         ku: 'شوێنایەتی',           relatesTo: [
    { en: 'Currencies',                  ku: 'دراوەکان' },
    { en: 'Languages',                   ku: 'زمانەکان' },
    { en: 'Number & date formats',       ku: 'شێوازی ژمارە و بەروار' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},
  currencies:     { en: 'Currencies',           ku: 'دراوەکان',            relatesTo: [
    { en: 'Invoices (multi-currency)',   ku: 'پسووڵەکان (چەند دراو)' },
    { en: 'Bills (multi-currency)',      ku: 'پسووڵەی کڕین (چەند دراو)' },
  ]},
  languages:      { en: 'Languages',            ku: 'زمانەکان',            relatesTo: [
    { en: 'Localization',                ku: 'شوێنایەتی' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},
  formats:        { en: 'Number & date formats', ku: 'شێوازی ژمارە و بەروار', relatesTo: [
    { en: 'Localization',                ku: 'شوێنایەتی' },
    { en: 'Invoices',                    ku: 'پسووڵەکان' },
  ]},

  // Finance & compliance
  fiscal:         { en: 'Fiscal year',          ku: 'ساڵی دارایی',         relatesTo: [
    { en: 'Invoices',                    ku: 'پسووڵەکان' },
    { en: 'Journals',                    ku: 'دەفتەرەکان' },
  ]},
  budgets:        { en: 'Budgets',              ku: 'بودجەکان',            relatesTo: [
    { en: 'Chart of accounts',           ku: 'پێرستی هەژمارەکان' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},
  taxes:          { en: 'Taxes',                ku: 'باجەکان',             relatesTo: [
    { en: 'Invoices',                    ku: 'پسووڵەکان' },
    { en: 'Bills',                       ku: 'پسووڵەی کڕین' },
  ]},
  banking:        { en: 'Banking',              ku: 'بانکداری',            relatesTo: [
    { en: 'Banking module',              ku: 'مۆدێڵی بانکداری' },
    { en: 'Payments',                    ku: 'پارەدانەکان' },
  ]},
  payment_methods:{ en: 'Payment methods',      ku: 'ڕێگاکانی پارەدان',    relatesTo: [
    { en: 'Payments',                    ku: 'پارەدانەکان' },
    { en: 'Invoices',                    ku: 'پسووڵەکان' },
  ]},
  einvoice:       { en: 'E-invoicing',          ku: 'پسووڵەی ئەلیکترۆنی',  relatesTo: [
    { en: 'Invoices',                    ku: 'پسووڵەکان' },
    { en: 'Tax settings',                ku: 'ڕێکخستنی باج' },
  ]},
  templates:      { en: 'Document templates',   ku: 'قاڵبەکانی بەڵگە',     relatesTo: [
    { en: 'Invoices',                    ku: 'پسووڵەکان' },
    { en: 'Branding',                    ku: 'برانڈینگ' },
  ]},
  reminders:      { en: 'Payment reminders',    ku: 'بیرخستنەوەی پارەدان', relatesTo: [
    { en: 'Invoices',                    ku: 'پسووڵەکان' },
    { en: 'Email settings',              ku: 'ڕێکخستنەکانی ئیمێل' },
  ]},

  // Commerce
  sales:          { en: 'Sales',                ku: 'فرۆشتن',              relatesTo: [
    { en: 'Invoices',                    ku: 'پسووڵەکان' },
    { en: 'Quotes',                      ku: 'وەسڵی نرخ' },
  ]},
  crm:            { en: 'CRM',                  ku: 'CRM',                 relatesTo: [
    { en: 'Contacts',                    ku: 'پەیوەندیەکان' },
    { en: 'Customers',                   ku: 'کڕیارەکان' },
  ]},
  purchases:      { en: 'Purchases',            ku: 'کڕینەکان',            relatesTo: [
    { en: 'Bills',                       ku: 'پسووڵەی کڕین' },
    { en: 'Purchase orders',             ku: 'فەرمانی کڕین' },
  ]},
  inventory:      { en: 'Inventory',            ku: 'کۆگا',                relatesTo: [
    { en: 'Inventory module',            ku: 'مۆدێڵی کۆگا' },
    { en: 'Warehouses',                  ku: 'کۆگاکان' },
  ]},
  mrp:            { en: 'Manufacturing (MRP)',  ku: 'بەرهەمهێنان (MRP)',   relatesTo: [
    { en: 'Inventory',                   ku: 'کۆگا' },
    { en: 'Items',                       ku: 'بەرهەمەکان' },
  ]},
  pos:            { en: 'Point of sale',        ku: 'خاڵی فرۆش',           relatesTo: [
    { en: 'Invoices',                    ku: 'پسووڵەکان' },
    { en: 'Items',                       ku: 'بەرهەمەکان' },
  ]},
  ecommerce:      { en: 'E-commerce',           ku: 'بازرگانی ئەلیکترۆنی', relatesTo: [
    { en: 'Online store',                ku: 'فرۆشگای ئۆنلاین' },
    { en: 'Items',                       ku: 'بەرهەمەکان' },
  ]},
  helpdesk:       { en: 'Helpdesk',             ku: 'دەسکی یارمەتی',       relatesTo: [
    { en: 'Contacts',                    ku: 'پەیوەندیەکان' },
    { en: 'Email settings',              ku: 'ڕێکخستنەکانی ئیمێل' },
  ]},

  // Operations
  hr:             { en: 'Human resources',      ku: 'سەرچاوە مرۆییەکان',   relatesTo: [
    { en: 'Payroll',                     ku: 'موچە' },
    { en: 'Working hours',               ku: 'کاتژمێرەکانی کار' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},
  payroll:        { en: 'Payroll',              ku: 'موچە',                relatesTo: [
    { en: 'Human resources',             ku: 'سەرچاوە مرۆییەکان' },
    { en: 'Journals',                    ku: 'دەفتەرەکان' },
  ]},
  projects:       { en: 'Projects',             ku: 'پرۆژەکان',            relatesTo: [
    { en: 'Human resources',             ku: 'سەرچاوە مرۆییەکان' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},
  marketing:      { en: 'Marketing',            ku: 'بازاڕگەرێ',           relatesTo: [
    { en: 'Contacts',                    ku: 'پەیوەندیەکان' },
    { en: 'Email settings',              ku: 'ڕێکخستنەکانی ئیمێل' },
  ]},

  // Automation & integrations
  workflows:      { en: 'Workflows',            ku: 'پرۆسەکان',            relatesTo: [
    { en: 'Approvals',                   ku: 'پەسەندکردنەکان' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},
  approvals:      { en: 'Approvals',            ku: 'پەسەندکردنەکان',      relatesTo: [
    { en: 'Workflows',                   ku: 'پرۆسەکان' },
    { en: 'Invoices',                    ku: 'پسووڵەکان' },
  ]},
  integrations:   { en: 'Integrations',         ku: 'پێکەوەگرێدانەکان',    relatesTo: [
    { en: 'Webhooks',                    ku: 'وێبهوک' },
    { en: 'API tokens',                  ku: 'تۆکنی API' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},
  webhooks:       { en: 'Webhooks',             ku: 'وێبهوک',              relatesTo: [
    { en: 'Integrations',                ku: 'پێکەوەگرێدانەکان' },
    { en: 'API tokens',                  ku: 'تۆکنی API' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},
  api_tokens:     { en: 'API tokens',           ku: 'تۆکنی API',           relatesTo: [
    { en: 'Integrations',                ku: 'پێکەوەگرێدانەکان' },
    { en: 'Webhooks',                    ku: 'وێبهوک' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},

  // Content & comms
  documents:      { en: 'Documents',            ku: 'بەڵگەکان',            relatesTo: [
    { en: 'Numbering sequences',         ku: 'ڕیزبەندیی ژمارە' },
    { en: 'Invoices',                    ku: 'پسووڵەکان' },
  ]},
  numbering:      { en: 'Numbering sequences',  ku: 'ڕیزبەندیی ژمارە',     relatesTo: [
    { en: 'Invoices',                    ku: 'پسووڵەکان' },
    { en: 'Bills',                       ku: 'پسووڵەی کڕین' },
  ]},
  email:          { en: 'Email settings',       ku: 'ڕێکخستنەکانی ئیمێل',  relatesTo: [
    { en: 'Notifications',               ku: 'ئاگادارکردنەوەکان' },
    { en: 'Payment reminders',           ku: 'بیرخستنەوەی پارەدان' },
    { en: 'Invoices',                    ku: 'پسووڵەکان' },
  ]},
  sms_whatsapp:   { en: 'SMS & WhatsApp',       ku: 'SMS و واتساپ',        relatesTo: [
    { en: 'Notifications',               ku: 'ئاگادارکردنەوەکان' },
    { en: 'Contacts',                    ku: 'پەیوەندیەکان' },
  ]},

  // System
  modules:        { en: 'Modules',              ku: 'مۆدێڵەکان',           relatesTo: [
    { en: 'Feature flags',               ku: 'ئاڵای تایبەتمەندی' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},
  backup:         { en: 'Backup & restore',    ku: 'پاشەکەوت و گەڕاندنەوە', relatesTo: [
    { en: 'System',                      ku: 'سیستەم' },
    { en: 'Audit log',                   ku: 'لۆگی پشکنین' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},
  activity:       { en: 'Activity log',         ku: 'لۆگی چالاکی',         relatesTo: [
    { en: 'Audit log',                   ku: 'لۆگی پشکنین' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},
  audit:          { en: 'Audit log',            ku: 'لۆگی پشکنین',         relatesTo: [
    { en: 'Activity log',                ku: 'لۆگی چالاکی' },
    { en: 'Data privacy (GDPR)',         ku: 'تایبەتمەندیی داتا (GDPR)' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},
  gdpr:           { en: 'Data privacy (GDPR)',  ku: 'تایبەتمەندیی داتا (GDPR)', relatesTo: [
    { en: 'Audit log',                   ku: 'لۆگی پشکنین' },
    { en: 'Users',                       ku: 'بەکارهێنەران' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},
  mobile:         { en: 'Mobile app',           ku: 'ئەپی مۆبایل',         relatesTo: [
    { en: 'Appearance',                  ku: 'دیمەن' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},
  system:         { en: 'System',               ku: 'سیستەم',              relatesTo: [
    { en: 'Backup & restore',            ku: 'پاشەکەوت و گەڕاندنەوە' },
    { en: 'Activity log',                ku: 'لۆگی چالاکی' },
    { en: 'Dashboard',                   ku: 'داشبۆرد' },
  ]},
};

// ─────────────────────────────────────────────────────────────────────────
// Placeholder content templates
//
// These produce a usable English / Kurdish string for any Settings sub-section
// when the canonical text from `settings-documentation` is not yet present.
// Wording is professional and section-aware so screens render coherently
// even before the sibling spec ships its final copy.
// ─────────────────────────────────────────────────────────────────────────

function tWhatEn(label) {
  return `${label} controls how this part of the system behaves across your organization.`;
}
function tWhatKu(label) {
  return `${label} هەڵسوکەوتی ئەم بەشە لە سیستەم لە سەرتاسەری ڕێکخراوەکەت بەڕێوە دەبات.`;
}
function tWhyEn(label) {
  return `Configure ${label} so other parts of the product (invoices, reports, automation) inherit consistent behavior.`;
}
function tWhyKu(label) {
  return `${label} ڕێک بخە بۆ ئەوەی بەشەکانی تری بەرهەمەکە (پسووڵە، ڕاپۆرت، خۆکارکردن) هەڵسوکەوتێکی یەکسان وەربگرن.`;
}
function tStepEn(label, n) {
  switch (n) {
    case 1: return `Open Settings and select ${label}.`;
    case 2: return `Review the current configuration and adjust the fields you need.`;
    case 3: return `Save your changes — the new settings take effect immediately.`;
    default: return `Continue configuring ${label} as needed.`;
  }
}
function tStepKu(label, n) {
  switch (n) {
    case 1: return `ڕێکخستنەکان بکەرەوە و ${label} هەڵبژێرە.`;
    case 2: return `ڕێکخستنی ئێستا بپشکنە و ئەو خانانە دەستکاری بکە کە پێویستن.`;
    case 3: return `گۆڕانکارییەکانت پاشەکەوت بکە — ڕێکخستنە نوێیەکان دەستبەجێ کاری دەکات.`;
    default: return `بەردەوام بە لە ڕێکخستنی ${label}.`;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Seeder
// ─────────────────────────────────────────────────────────────────────────

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function isMissing(obj, key) {
  if (!(key in obj)) return true;
  const v = obj[key];
  return v === '' || v == null || v === 'TODO' || v === '[missing]';
}

function setIfMissing(obj, key, value) {
  if (isMissing(obj, key)) {
    obj[key] = value;
    return true;
  }
  return false;
}

function buildKeysForSection(sectionKey, meta) {
  // Returns an array of [key, enValue, kuValue]
  const out = [];
  out.push([`settings.help.${sectionKey}.what`, tWhatEn(meta.en), tWhatKu(meta.ku)]);
  out.push([`settings.help.${sectionKey}.why`,  tWhyEn(meta.en),  tWhyKu(meta.ku)]);
  for (let n = 1; n <= STEPS_PER_SETTINGS; n++) {
    out.push([`settings.help.${sectionKey}.step_${n}`, tStepEn(meta.en, n), tStepKu(meta.ku, n)]);
  }
  meta.relatesTo.forEach((rel, i) => {
    out.push([`settings.help.${sectionKey}.relates_to.${i}.label`, rel.en, rel.ku]);
  });
  return out;
}

function main() {
  const en = loadJson(enPath);
  const ku = loadJson(kuPath);

  let addedEn = 0;
  let addedKu = 0;
  const log = [];

  // Insertion order matters for diff reviewability — we preserve the existing
  // file's key order and append only the genuinely new keys, in `SectionId`
  // order, at the end of each locale.
  for (const [sectionKey, meta] of Object.entries(SETTINGS)) {
    const triples = buildKeysForSection(sectionKey, meta);
    for (const [key, enVal, kuVal] of triples) {
      const aE = setIfMissing(en, key, enVal);
      const aK = setIfMissing(ku, key, kuVal);
      if (aE) addedEn++;
      if (aK) addedKu++;
      if (aE || aK) log.push(`  ${key}  [en:${aE ? '+' : '='} ku:${aK ? '+' : '='}]`);
    }
  }

  // Detect existing line ending style so we don't churn diffs.
  const enRaw = fs.readFileSync(enPath, 'utf8');
  const kuRaw = fs.readFileSync(kuPath, 'utf8');
  const enEol = enRaw.includes('\r\n') ? '\r\n' : '\n';
  const kuEol = kuRaw.includes('\r\n') ? '\r\n' : '\n';

  const enOut = JSON.stringify(en, null, 2).replace(/\n/g, enEol) + enEol;
  const kuOut = JSON.stringify(ku, null, 2).replace(/\n/g, kuEol) + kuEol;
  fs.writeFileSync(enPath, enOut, 'utf8');
  fs.writeFileSync(kuPath, kuOut, 'utf8');

  console.log(`Added ${addedEn} new keys to en.json`);
  console.log(`Added ${addedKu} new keys to ku.json`);
  console.log(`Total Settings sections processed: ${Object.keys(SETTINGS).length}`);
  if (log.length) {
    console.log('\nFirst 30 changes:');
    for (const line of log.slice(0, 30)) console.log(line);
    if (log.length > 30) console.log(`  …and ${log.length - 30} more`);
  }
}

main();
