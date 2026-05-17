/**
 * Unit tests for locale key completeness
 *
 * Asserts that every key added in tasks 1.1–1.7 exists in both en.json and ku.json:
 *   - All nav.* keys (section labels and blurbs)
 *   - All mod_* keys (module labels)
 *   - Utility keys: help, add_entity
 *   - All settings.help.<section>.what / .why / .step_1 keys
 *
 * Requirements: 3.3, 3.4, 3.6, 3.7, 7.7
 */
import { describe, it, expect } from 'vitest';
import enJson from './en.json';
import kuJson from './ku.json';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flatten a potentially nested JSON object into dot-notation keys. */
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return flattenKeys(value as Record<string, unknown>, fullKey);
    }
    return [fullKey];
  });
}

const enKeys = new Set(flattenKeys(enJson as Record<string, unknown>));
const kuKeys = new Set(flattenKeys(kuJson as Record<string, unknown>));

function assertKeyInBothLocales(key: string) {
  expect(enKeys.has(key), `en.json is missing key: "${key}"`).toBe(true);
  expect(kuKeys.has(key), `ku.json is missing key: "${key}"`).toBe(true);
}

// ---------------------------------------------------------------------------
// Nav section and zone keys (tasks 1.1 & 1.2)
// ---------------------------------------------------------------------------

const NAV_SECTION_KEYS = [
  'nav.ext_ops',
  'nav.ext_ops_blurb',
  'nav.ext_platform',
  'nav.ext_platform_blurb',
  'nav.ext_vertical',
  'nav.ext_vertical_blurb',
  'nav.admin_config',
  'nav.admin_config_blurb',
  'nav.setup_blurb',
  'nav.zone_core_commerce',
  'nav.zone_core_commerce_blurb',
  'nav.zone_operations',
  'nav.zone_operations_blurb',
  'nav.zone_people',
  'nav.zone_people_blurb',
  'nav.zone_finance_control',
  'nav.zone_finance_control_blurb',
] as const;

// ---------------------------------------------------------------------------
// Module label keys (tasks 1.3 & 1.4)
// ---------------------------------------------------------------------------

const MOD_KEYS = [
  'mod_quality',
  'mod_maintenance',
  'mod_plm',
  'mod_studio',
  'mod_rental',
  'mod_ai',
  'mod_mobile',
  'mod_iot',
  'mod_helpdesk_ext',
  'mod_fs_ext',
  'mod_docs_ext',
  'mod_kb_ext',
  'mod_hr_ext',
  'mod_hotel',
  'mod_restaurant',
  'mod_construction',
  'mod_real_estate',
  'mod_education',
  'mod_logistics',
  'mod_agriculture',
  'mod_ngo',
  'mod_government',
] as const;

// ---------------------------------------------------------------------------
// Utility keys (task 1.7)
// ---------------------------------------------------------------------------

const UTILITY_KEYS = ['help', 'add_entity'] as const;

// ---------------------------------------------------------------------------
// Settings help section keys (tasks 1.5 & 1.6)
// ---------------------------------------------------------------------------

const SETTINGS_HELP_SECTION_KEYS = [
  'fiscal',
  'currencies',
  'budgets',
  'taxes',
  'warehouses',
  'units',
  'categories',
  'brands',
  'pricelists',
  'payment_methods',
  'payment_terms',
  'accounts',
  'journals',
  'cost_centers',
  'analytic',
  'numbering',
  'automation',
  'audit',
  'jobs',
  'users',
  'roles',
  'company',
  'branches',
  'localization',
  'email',
  'sms',
  'notifications',
  'integrations',
  'appearance',
  'security',
  'backup',
  'studio',
  'docs_hub',
  'ui_gallery',
] as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Locale key completeness', () => {
  // -------------------------------------------------------------------------
  // Nav section and zone keys
  // -------------------------------------------------------------------------
  describe('nav.* section and zone keys (tasks 1.1 & 1.2)', () => {
    it.each(NAV_SECTION_KEYS)('"%s" exists in both en.json and ku.json', (key) => {
      assertKeyInBothLocales(key);
    });
  });

  // -------------------------------------------------------------------------
  // Module label keys
  // -------------------------------------------------------------------------
  describe('mod_* module label keys (tasks 1.3 & 1.4)', () => {
    it.each(MOD_KEYS)('"%s" exists in both en.json and ku.json', (key) => {
      assertKeyInBothLocales(key);
    });
  });

  // -------------------------------------------------------------------------
  // Utility keys
  // -------------------------------------------------------------------------
  describe('utility keys (task 1.7)', () => {
    it.each(UTILITY_KEYS)('"%s" exists in both en.json and ku.json', (key) => {
      assertKeyInBothLocales(key);
    });
  });

  // -------------------------------------------------------------------------
  // settings.help.* keys — .what, .why, .step_1 for every section
  // -------------------------------------------------------------------------
  describe('settings.help.<section>.what / .why / .step_1 keys (tasks 1.5 & 1.6)', () => {
    it.each(SETTINGS_HELP_SECTION_KEYS)(
      'settings.help.%s has .what, .why, and .step_1 in both locales',
      (section) => {
        const whatKey = `settings.help.${section}.what`;
        const whyKey = `settings.help.${section}.why`;
        const step1Key = `settings.help.${section}.step_1`;

        assertKeyInBothLocales(whatKey);
        assertKeyInBothLocales(whyKey);
        assertKeyInBothLocales(step1Key);
      },
    );
  });

  // -------------------------------------------------------------------------
  // Symmetry: every key in en.json settings.help block is also in ku.json
  // -------------------------------------------------------------------------
  describe('settings.help.* key symmetry between en.json and ku.json', () => {
    it('every settings.help.* key in en.json also exists in ku.json', () => {
      const enHelpKeys = [...enKeys].filter((k) => k.startsWith('settings.help.'));
      const missingInKu = enHelpKeys.filter((k) => !kuKeys.has(k));
      expect(
        missingInKu,
        `ku.json is missing these settings.help keys: ${missingInKu.join(', ')}`,
      ).toHaveLength(0);
    });

    it('every settings.help.* key in ku.json also exists in en.json', () => {
      const kuHelpKeys = [...kuKeys].filter((k) => k.startsWith('settings.help.'));
      const missingInEn = kuHelpKeys.filter((k) => !enKeys.has(k));
      expect(
        missingInEn,
        `en.json is missing these settings.help keys: ${missingInEn.join(', ')}`,
      ).toHaveLength(0);
    });
  });
});
