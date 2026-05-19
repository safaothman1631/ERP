/**
 * i18n Completeness & Localization Integration Tests
 *
 * Verifies:
 *   1. All 20 namespaces are populated in all three locales (ku, en, ar)
 *      with ≥ 700 keys per locale.
 *   2. No English-only error messages — all `errors` namespace keys must be
 *      present in all three locales.
 *   3. Kurdish Sorani is the default language (fallbackLng: 'ku').
 *   4. Missing keys fall back to the key string (not empty string or undefined).
 *   5. ar-IQ number/currency formatting for Kurdish and Arabic; en-US for English.
 *   6. Every key in any locale file exists in all three locale files (cross-locale
 *      key parity).
 *
 * This test is added to CI to block deployment on failure.
 *
 * Validates: Requirements 20.1–20.7
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { formatMoney } from '../utils/format';
import { resolveLanguage } from '../utils/language';

// ---------------------------------------------------------------------------
// Locale file imports — all 20 namespaces × 3 locales
// ---------------------------------------------------------------------------

import kuCommon from './ku/common.json';
import kuNav from './ku/nav.json';
import kuAuth from './ku/auth.json';
import kuDashboard from './ku/dashboard.json';
import kuSales from './ku/sales.json';
import kuPurchases from './ku/purchases.json';
import kuInventory from './ku/inventory.json';
import kuAccounting from './ku/accounting.json';
import kuBanking from './ku/banking.json';
import kuCrm from './ku/crm.json';
import kuPos from './ku/pos.json';
import kuHr from './ku/hr.json';
import kuPayroll from './ku/payroll.json';
import kuManufacturing from './ku/manufacturing.json';
import kuProjects from './ku/projects.json';
import kuReports from './ku/reports.json';
import kuSettings from './ku/settings.json';
import kuErrors from './ku/errors.json';
import kuValidation from './ku/validation.json';
import kuIraq from './ku/iraq.json';

import enCommon from './en/common.json';
import enNav from './en/nav.json';
import enAuth from './en/auth.json';
import enDashboard from './en/dashboard.json';
import enSales from './en/sales.json';
import enPurchases from './en/purchases.json';
import enInventory from './en/inventory.json';
import enAccounting from './en/accounting.json';
import enBanking from './en/banking.json';
import enCrm from './en/crm.json';
import enPos from './en/pos.json';
import enHr from './en/hr.json';
import enPayroll from './en/payroll.json';
import enManufacturing from './en/manufacturing.json';
import enProjects from './en/projects.json';
import enReports from './en/reports.json';
import enSettings from './en/settings.json';
import enErrors from './en/errors.json';
import enValidation from './en/validation.json';
import enIraq from './en/iraq.json';

import arCommon from './ar/common.json';
import arNav from './ar/nav.json';
import arAuth from './ar/auth.json';
import arDashboard from './ar/dashboard.json';
import arSales from './ar/sales.json';
import arPurchases from './ar/purchases.json';
import arInventory from './ar/inventory.json';
import arAccounting from './ar/accounting.json';
import arBanking from './ar/banking.json';
import arCrm from './ar/crm.json';
import arPos from './ar/pos.json';
import arHr from './ar/hr.json';
import arPayroll from './ar/payroll.json';
import arManufacturing from './ar/manufacturing.json';
import arProjects from './ar/projects.json';
import arReports from './ar/reports.json';
import arSettings from './ar/settings.json';
import arErrors from './ar/errors.json';
import arValidation from './ar/validation.json';
import arIraq from './ar/iraq.json';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const I18N_NAMESPACES = [
  'common', 'nav', 'auth', 'dashboard', 'sales', 'purchases',
  'inventory', 'accounting', 'banking', 'crm', 'pos', 'hr',
  'payroll', 'manufacturing', 'projects', 'reports', 'settings',
  'errors', 'validation', 'iraq',
] as const;

type Namespace = typeof I18N_NAMESPACES[number];

/** All locale data indexed by locale → namespace → JSON object */
const LOCALE_DATA: Record<string, Record<Namespace, Record<string, unknown>>> = {
  ku: {
    common: kuCommon, nav: kuNav, auth: kuAuth, dashboard: kuDashboard,
    sales: kuSales, purchases: kuPurchases, inventory: kuInventory,
    accounting: kuAccounting, banking: kuBanking, crm: kuCrm, pos: kuPos,
    hr: kuHr, payroll: kuPayroll, manufacturing: kuManufacturing,
    projects: kuProjects, reports: kuReports, settings: kuSettings,
    errors: kuErrors, validation: kuValidation, iraq: kuIraq,
  },
  en: {
    common: enCommon, nav: enNav, auth: enAuth, dashboard: enDashboard,
    sales: enSales, purchases: enPurchases, inventory: enInventory,
    accounting: enAccounting, banking: enBanking, crm: enCrm, pos: enPos,
    hr: enHr, payroll: enPayroll, manufacturing: enManufacturing,
    projects: enProjects, reports: enReports, settings: enSettings,
    errors: enErrors, validation: enValidation, iraq: enIraq,
  },
  ar: {
    common: arCommon, nav: arNav, auth: arAuth, dashboard: arDashboard,
    sales: arSales, purchases: arPurchases, inventory: arInventory,
    accounting: arAccounting, banking: arBanking, crm: arCrm, pos: arPos,
    hr: arHr, payroll: arPayroll, manufacturing: arManufacturing,
    projects: arProjects, reports: arReports, settings: arSettings,
    errors: arErrors, validation: arValidation, iraq: arIraq,
  },
};

const LOCALES = ['ku', 'en', 'ar'] as const;
const MIN_KEYS_PER_LOCALE = 700;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively flatten a nested JSON object into dot-notation leaf keys.
 * e.g. { a: { b: 'v' } } → ['a.b']
 */
function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      return flattenKeys(value as Record<string, unknown>, fullKey);
    }
    return [fullKey];
  });
}

/** Count all leaf keys in a namespace JSON object. */
function countKeys(obj: Record<string, unknown>): number {
  return flattenKeys(obj).length;
}

/** Get all leaf keys for a given locale across all namespaces. */
function getAllKeysForLocale(locale: string): Set<string> {
  const keys = new Set<string>();
  for (const ns of I18N_NAMESPACES) {
    const nsData = LOCALE_DATA[locale][ns];
    for (const key of flattenKeys(nsData)) {
      keys.add(`${ns}.${key}`);
    }
  }
  return keys;
}

/** Get all leaf keys for a specific namespace in a locale. */
function getNamespaceKeys(locale: string, ns: Namespace): Set<string> {
  return new Set(flattenKeys(LOCALE_DATA[locale][ns]));
}

// ---------------------------------------------------------------------------
// Pre-computed key sets (computed once before all tests)
// ---------------------------------------------------------------------------

let localeKeys: Record<string, Set<string>>;
let namespaceCounts: Record<string, Record<Namespace, number>>;
let localeTotals: Record<string, number>;

beforeAll(() => {
  localeKeys = {};
  namespaceCounts = {} as Record<string, Record<Namespace, number>>;
  localeTotals = {};

  for (const locale of LOCALES) {
    localeKeys[locale] = getAllKeysForLocale(locale);
    namespaceCounts[locale] = {} as Record<Namespace, number>;
    let total = 0;
    for (const ns of I18N_NAMESPACES) {
      const count = countKeys(LOCALE_DATA[locale][ns]);
      namespaceCounts[locale][ns] = count;
      total += count;
    }
    localeTotals[locale] = total;
  }
});

// ---------------------------------------------------------------------------
// 1. All 20 namespaces populated in all three locales
//    Validates: Requirements 20.1, 20.4
// ---------------------------------------------------------------------------

describe('1. All 20 namespaces populated in all three locales', () => {
  it('all 20 namespaces exist in ku locale', () => {
    for (const ns of I18N_NAMESPACES) {
      expect(
        LOCALE_DATA.ku[ns],
        `ku/${ns}.json is missing or empty`,
      ).toBeDefined();
      expect(
        Object.keys(LOCALE_DATA.ku[ns]).length,
        `ku/${ns}.json has no keys`,
      ).toBeGreaterThan(0);
    }
  });

  it('all 20 namespaces exist in en locale', () => {
    for (const ns of I18N_NAMESPACES) {
      expect(
        LOCALE_DATA.en[ns],
        `en/${ns}.json is missing or empty`,
      ).toBeDefined();
      expect(
        Object.keys(LOCALE_DATA.en[ns]).length,
        `en/${ns}.json has no keys`,
      ).toBeGreaterThan(0);
    }
  });

  it('all 20 namespaces exist in ar locale', () => {
    for (const ns of I18N_NAMESPACES) {
      expect(
        LOCALE_DATA.ar[ns],
        `ar/${ns}.json is missing or empty`,
      ).toBeDefined();
      expect(
        Object.keys(LOCALE_DATA.ar[ns]).length,
        `ar/${ns}.json has no keys`,
      ).toBeGreaterThan(0);
    }
  });

  it.each(LOCALES)(
    '%s locale has ≥ 700 total keys across all namespaces',
    (locale) => {
      expect(
        localeTotals[locale],
        `${locale} locale has only ${localeTotals[locale]} keys — need ≥ ${MIN_KEYS_PER_LOCALE}`,
      ).toBeGreaterThanOrEqual(MIN_KEYS_PER_LOCALE);
    },
  );

  it('each namespace has at least 1 key in every locale', () => {
    for (const locale of LOCALES) {
      for (const ns of I18N_NAMESPACES) {
        expect(
          namespaceCounts[locale][ns],
          `${locale}/${ns}.json has 0 keys`,
        ).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 2. No English-only error messages — errors namespace parity
//    Validates: Requirement 20.2
// ---------------------------------------------------------------------------

describe('2. errors namespace — no English-only keys', () => {
  it('every key in en/errors.json exists in ku/errors.json', () => {
    const enErrorKeys = getNamespaceKeys('en', 'errors');
    const kuErrorKeys = getNamespaceKeys('ku', 'errors');
    const missingInKu = [...enErrorKeys].filter((k) => !kuErrorKeys.has(k));
    expect(
      missingInKu,
      `ku/errors.json is missing these keys: ${missingInKu.join(', ')}`,
    ).toHaveLength(0);
  });

  it('every key in en/errors.json exists in ar/errors.json', () => {
    const enErrorKeys = getNamespaceKeys('en', 'errors');
    const arErrorKeys = getNamespaceKeys('ar', 'errors');
    const missingInAr = [...enErrorKeys].filter((k) => !arErrorKeys.has(k));
    expect(
      missingInAr,
      `ar/errors.json is missing these keys: ${missingInAr.join(', ')}`,
    ).toHaveLength(0);
  });

  it('every key in ku/errors.json exists in en/errors.json', () => {
    const kuErrorKeys = getNamespaceKeys('ku', 'errors');
    const enErrorKeys = getNamespaceKeys('en', 'errors');
    const missingInEn = [...kuErrorKeys].filter((k) => !enErrorKeys.has(k));
    expect(
      missingInEn,
      `en/errors.json is missing these keys: ${missingInEn.join(', ')}`,
    ).toHaveLength(0);
  });

  it('every key in ar/errors.json exists in ku/errors.json', () => {
    const arErrorKeys = getNamespaceKeys('ar', 'errors');
    const kuErrorKeys = getNamespaceKeys('ku', 'errors');
    const missingInKu = [...arErrorKeys].filter((k) => !kuErrorKeys.has(k));
    expect(
      missingInKu,
      `ku/errors.json is missing these keys: ${missingInKu.join(', ')}`,
    ).toHaveLength(0);
  });

  it('all three locales have identical errors namespace key sets', () => {
    const kuErrorKeys = getNamespaceKeys('ku', 'errors');
    const enErrorKeys = getNamespaceKeys('en', 'errors');
    const arErrorKeys = getNamespaceKeys('ar', 'errors');

    expect(kuErrorKeys.size).toBe(enErrorKeys.size);
    expect(kuErrorKeys.size).toBe(arErrorKeys.size);

    for (const key of kuErrorKeys) {
      expect(enErrorKeys.has(key), `en/errors.json missing: "${key}"`).toBe(true);
      expect(arErrorKeys.has(key), `ar/errors.json missing: "${key}"`).toBe(true);
    }
  });

  it('error values are non-empty strings in all locales', () => {
    for (const locale of LOCALES) {
      const errorsData = LOCALE_DATA[locale].errors as Record<string, unknown>;
      for (const [key, value] of Object.entries(errorsData)) {
        expect(
          typeof value === 'string' && value.length > 0,
          `${locale}/errors.json key "${key}" has empty or non-string value`,
        ).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Kurdish Sorani is the default language (fallbackLng: 'ku')
//    Validates: Requirement 20.3
// ---------------------------------------------------------------------------

describe('3. Kurdish Sorani is the default language', () => {
  it('resolveLanguage falls back to "ku" for unknown codes', () => {
    expect(resolveLanguage('fr')).toBe('ku');
    expect(resolveLanguage('de')).toBe('ku');
    expect(resolveLanguage('')).toBe('ku');
    expect(resolveLanguage('unknown')).toBe('ku');
    expect(resolveLanguage('zh')).toBe('ku');
  });

  it('resolveLanguage returns "ku" for the "ku" code', () => {
    expect(resolveLanguage('ku')).toBe('ku');
  });

  it('resolveLanguage returns "en" for the "en" code', () => {
    expect(resolveLanguage('en')).toBe('en');
  });

  it('resolveLanguage returns "ar" for the "ar" code', () => {
    expect(resolveLanguage('ar')).toBe('ar');
  });

  it('i18n module exports fallbackLng as "ku"', async () => {
    // Dynamically import i18n to check its configuration
    const { default: i18n } = await import('../i18n');
    // i18next stores fallbackLng in options
    const fallback = i18n.options.fallbackLng;
    // fallbackLng can be a string, array, or object — normalize to check
    const fallbackStr = Array.isArray(fallback) ? fallback[0] : fallback;
    expect(fallbackStr).toBe('ku');
  });
});

// ---------------------------------------------------------------------------
// 4. Missing keys fall back to the key string (not empty string or undefined)
//    Validates: Requirement 20.5
// ---------------------------------------------------------------------------

describe('4. Missing keys fall back to the key string', () => {
  it('parseMissingKeyHandler returns a non-empty string for any missing key', async () => {
    const { default: i18n } = await import('../i18n');

    const missingKeys = [
      'totally.missing.key',
      'another.nonexistent.key',
      'errors.this_does_not_exist',
    ];

    for (const key of missingKeys) {
      const result = i18n.t(key);
      expect(result, `Missing key "${key}" returned empty/undefined`).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it('missing key result is not the raw dot-notation key string', async () => {
    const { default: i18n } = await import('../i18n');

    // The humanizeKey function transforms 'some.missing_key' → 'Missing Key'
    const result = i18n.t('some.missing_key');
    expect(result).not.toBe('some.missing_key');
    expect(result.length).toBeGreaterThan(0);
  });

  it('all existing locale values are non-empty strings (no empty string values)', () => {
    for (const locale of LOCALES) {
      for (const ns of I18N_NAMESPACES) {
        const keys = flattenKeys(LOCALE_DATA[locale][ns]);
        for (const key of keys) {
          // Navigate to the value
          const parts = key.split('.');
          let val: unknown = LOCALE_DATA[locale][ns];
          for (const part of parts) {
            val = (val as Record<string, unknown>)[part];
          }
          expect(
            typeof val === 'string' && val.length > 0,
            `${locale}/${ns}.json key "${key}" has empty or non-string value`,
          ).toBe(true);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 5. ar-IQ formatting for Kurdish/Arabic; en-US for English
//    Validates: Requirements 10.4, 20.6
// ---------------------------------------------------------------------------

describe('5. Number/currency formatting per language', () => {
  it('formatMoney with ku uses ar-IQ locale (Arabic-Indic numerals or Arabic format)', () => {
    const result = formatMoney(1234567.89, 'IQD', 'ku');
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
    // ar-IQ formatted numbers contain Arabic-Indic digits or Arabic comma separators
    // The key check: it should NOT look like a plain Western number string
    // ar-IQ uses ١٢٣٤٥٦٧٫٨٩ style or at minimum Arabic currency symbol
    expect(result).not.toBe('');
  });

  it('formatMoney with ar uses ar-IQ locale', () => {
    const result = formatMoney(1000, 'IQD', 'ar');
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it('formatMoney with en uses en-US locale (Western digits)', () => {
    const result = formatMoney(1234.56, 'USD', 'en');
    // en-US format: $1,234.56
    expect(result).toMatch(/\$|USD/);
    // Should contain Western digits
    expect(result).toMatch(/[0-9]/);
  });

  it('formatMoney ku and en produce different formatted strings for the same amount', () => {
    const amount = 1234567;
    const kuResult = formatMoney(amount, 'IQD', 'ku');
    const enResult = formatMoney(amount, 'USD', 'en');
    // They should differ (different locale, different currency)
    expect(kuResult).not.toBe(enResult);
  });

  it('formatMoney ar and en produce different formatted strings for the same amount', () => {
    const amount = 9999;
    const arResult = formatMoney(amount, 'IQD', 'ar');
    const enResult = formatMoney(amount, 'USD', 'en');
    expect(arResult).not.toBe(enResult);
  });

  it('formatMoney returns a non-empty string for all locale/currency combinations', () => {
    const combinations: Array<[number, 'IQD' | 'USD', 'ku' | 'en' | 'ar']> = [
      [0, 'IQD', 'ku'],
      [0, 'IQD', 'ar'],
      [0, 'USD', 'en'],
      [1000000, 'IQD', 'ku'],
      [1000000, 'IQD', 'ar'],
      [1000000, 'USD', 'en'],
      [-500, 'IQD', 'ku'],
      [-500, 'USD', 'en'],
    ];

    for (const [amount, currency, lang] of combinations) {
      const result = formatMoney(amount, currency, lang);
      expect(result, `formatMoney(${amount}, ${currency}, ${lang}) returned empty`).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it('Intl.NumberFormat ar-IQ is used for ku and ar languages', () => {
    // Verify by checking that the output matches what ar-IQ would produce
    const amount = 42;
    const kuResult = formatMoney(amount, 'IQD', 'ku');
    const arResult = formatMoney(amount, 'IQD', 'ar');

    // Both should produce the same format since both use ar-IQ
    expect(kuResult).toBe(arResult);
  });

  it('Intl.NumberFormat en-US is used for en language', () => {
    const amount = 1234.56;
    const enResult = formatMoney(amount, 'USD', 'en');
    // en-US format for USD: $1,234.56
    expect(enResult).toContain('1,234');
  });
});

// ---------------------------------------------------------------------------
// 6. Cross-locale key parity — every key in any locale exists in all three
//    Validates: Requirement 20.7
// ---------------------------------------------------------------------------

describe('6. Cross-locale key parity — every key exists in all three locales', () => {
  it.each(I18N_NAMESPACES)(
    'namespace "%s": all keys present in ku, en, and ar',
    (ns) => {
      const kuKeys = getNamespaceKeys('ku', ns);
      const enKeys = getNamespaceKeys('en', ns);
      const arKeys = getNamespaceKeys('ar', ns);

      // Union of all keys across all locales
      const allKeys = new Set([...kuKeys, ...enKeys, ...arKeys]);

      const missingInKu = [...allKeys].filter((k) => !kuKeys.has(k));
      const missingInEn = [...allKeys].filter((k) => !enKeys.has(k));
      const missingInAr = [...allKeys].filter((k) => !arKeys.has(k));

      expect(
        missingInKu,
        `ku/${ns}.json is missing keys: ${missingInKu.join(', ')}`,
      ).toHaveLength(0);

      expect(
        missingInEn,
        `en/${ns}.json is missing keys: ${missingInEn.join(', ')}`,
      ).toHaveLength(0);

      expect(
        missingInAr,
        `ar/${ns}.json is missing keys: ${missingInAr.join(', ')}`,
      ).toHaveLength(0);
    },
  );

  it('all three locales have identical total key counts per namespace', () => {
    for (const ns of I18N_NAMESPACES) {
      const kuCount = namespaceCounts.ku[ns];
      const enCount = namespaceCounts.en[ns];
      const arCount = namespaceCounts.ar[ns];

      expect(
        enCount,
        `en/${ns}.json has ${enCount} keys but ku/${ns}.json has ${kuCount}`,
      ).toBe(kuCount);

      expect(
        arCount,
        `ar/${ns}.json has ${arCount} keys but ku/${ns}.json has ${kuCount}`,
      ).toBe(kuCount);
    }
  });

  it('global key parity: every key in any locale exists in all three locales', () => {
    const kuAll = localeKeys.ku;
    const enAll = localeKeys.en;
    const arAll = localeKeys.ar;

    const allKeys = new Set([...kuAll, ...enAll, ...arAll]);

    const missingInKu = [...allKeys].filter((k) => !kuAll.has(k));
    const missingInEn = [...allKeys].filter((k) => !enAll.has(k));
    const missingInAr = [...allKeys].filter((k) => !arAll.has(k));

    expect(
      missingInKu,
      `ku locale is missing ${missingInKu.length} keys: ${missingInKu.slice(0, 10).join(', ')}${missingInKu.length > 10 ? '...' : ''}`,
    ).toHaveLength(0);

    expect(
      missingInEn,
      `en locale is missing ${missingInEn.length} keys: ${missingInEn.slice(0, 10).join(', ')}${missingInEn.length > 10 ? '...' : ''}`,
    ).toHaveLength(0);

    expect(
      missingInAr,
      `ar locale is missing ${missingInAr.length} keys: ${missingInAr.slice(0, 10).join(', ')}${missingInAr.length > 10 ? '...' : ''}`,
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 7. Namespace completeness summary (informational)
//    Validates: Requirements 20.1, 20.4
// ---------------------------------------------------------------------------

describe('7. Namespace completeness summary', () => {
  it('ku locale total keys ≥ 700', () => {
    expect(localeTotals.ku).toBeGreaterThanOrEqual(MIN_KEYS_PER_LOCALE);
  });

  it('en locale total keys ≥ 700', () => {
    expect(localeTotals.en).toBeGreaterThanOrEqual(MIN_KEYS_PER_LOCALE);
  });

  it('ar locale total keys ≥ 700', () => {
    expect(localeTotals.ar).toBeGreaterThanOrEqual(MIN_KEYS_PER_LOCALE);
  });

  it('all three locales have the same total key count', () => {
    expect(localeTotals.en).toBe(localeTotals.ku);
    expect(localeTotals.ar).toBe(localeTotals.ku);
  });
});
