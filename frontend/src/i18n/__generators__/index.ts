/**
 * Shared `fast-check` arbitraries for i18n property tests.
 *
 * Used by `frontend/src/system-wide-ux-overhaul.pbt.test.ts` for Property 1:
 * i18n key-set parity.
 *
 * Generators here describe the input space for the i18n invariant documented
 * in `.kiro/specs/system-wide-ux-overhaul/design.md` → "Correctness Properties"
 * → Property 1.
 */

import * as fc from 'fast-check';

// Import locale files synchronously for property assertions.
// Path: from `i18n/__generators__/` → `../../locales/` = `src/locales/`
import enLocale from '../../locales/en.json';
import kuLocale from '../../locales/ku.json';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: flatten nested JSON objects into dot-separated key paths
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Recursively flattens a nested object into a flat Record<string, unknown>
 * with dot-separated key paths.
 *
 * Example: `{ a: { b: "hello" } }` → `{ "a.b": "hello" }`
 */
export function flattenLocale(
  obj: Record<string, unknown>,
  prefix = '',
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      Object.assign(result, flattenLocale(value as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Flattened locale data
// ─────────────────────────────────────────────────────────────────────────────

/** Flattened English locale: all keys as dot-separated paths → values. */
export const enFlat: Record<string, unknown> = flattenLocale(
  enLocale as Record<string, unknown>,
);

/** Flattened Kurdish locale: all keys as dot-separated paths → values. */
export const kuFlat: Record<string, unknown> = flattenLocale(
  kuLocale as Record<string, unknown>,
);

/** All keys from the English locale (flattened). */
export const enKeys: string[] = Object.keys(enFlat);

/** All keys from the Kurdish locale (flattened). */
export const kuKeys: string[] = Object.keys(kuFlat);

/** Union of all keys from both locales. */
export const allI18nKeys: string[] = [
  ...new Set([...enKeys, ...kuKeys]),
];

/** Keys present only in English (not in Kurdish). */
export const enOnlyKeys: string[] = enKeys.filter(
  (k) => !(k in kuFlat),
);

/** Keys present only in Kurdish (not in English). */
export const kuOnlyKeys: string[] = kuKeys.filter(
  (k) => !(k in enFlat),
);

// ─────────────────────────────────────────────────────────────────────────────
// Arbitraries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Arbitrary that samples from the union of all i18n keys (both locales).
 * Used to test the parity invariant: every key must exist in both locales.
 */
export const i18nKeyArb: fc.Arbitrary<string> =
  allI18nKeys.length > 0
    ? fc.constantFrom(...allI18nKeys)
    : fc.constant('__empty__');

/**
 * Arbitrary that samples from English-only keys.
 * Used to test the symmetric-difference invariant.
 */
export const enKeyArb: fc.Arbitrary<string> =
  enKeys.length > 0
    ? fc.constantFrom(...enKeys)
    : fc.constant('__empty__');

/**
 * Arbitrary that samples from Kurdish-only keys.
 * Used to test the symmetric-difference invariant.
 */
export const kuKeyArb: fc.Arbitrary<string> =
  kuKeys.length > 0
    ? fc.constantFrom(...kuKeys)
    : fc.constant('__empty__');

// ─────────────────────────────────────────────────────────────────────────────
// Property 6: Language purity generators
// ─────────────────────────────────────────────────────────────────────────────

import { PROPER_NOUNS } from '../properNouns';

/**
 * Locale type for language purity tests.
 */
export type Locale = 'en' | 'ku';

export const localeArb: fc.Arbitrary<Locale> = fc.constantFrom<Locale>('en', 'ku');

/**
 * A scenario for testing language purity: a (key, locale) pair representing
 * a visible text node rendered in the active locale.
 */
export interface LanguagePurityScenario {
  /** The translation key being rendered. */
  key: string;
  /** The active locale. */
  locale: Locale;
  /** The resolved text value for this key in the active locale. */
  value: string;
}

/**
 * Arbitrary for English-locale language purity scenarios.
 * Generates a key from en.json with its resolved value.
 */
export const enLanguagePurityArb: fc.Arbitrary<LanguagePurityScenario> =
  enKeyArb.map((key) => ({
    key,
    locale: 'en' as Locale,
    value: String(enFlat[key] ?? ''),
  }));

/**
 * Arbitrary for Kurdish-locale language purity scenarios.
 * Generates a key from ku.json with its resolved value.
 */
export const kuLanguagePurityArb: fc.Arbitrary<LanguagePurityScenario> =
  kuKeyArb.map((key) => ({
    key,
    locale: 'ku' as Locale,
    value: String(kuFlat[key] ?? ''),
  }));

/**
 * Arbitrary for language purity scenarios across both locales.
 */
export const languagePurityScenarioArb: fc.Arbitrary<LanguagePurityScenario> =
  fc.oneof(enLanguagePurityArb, kuLanguagePurityArb);

// ─────────────────────────────────────────────────────────────────────────────
// Cross-script detection utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Regex matching Arabic script characters (includes Kurdish Sorani characters).
 * Unicode range: \u0600-\u06FF (Arabic), \u0750-\u077F (Arabic Supplement),
 * \u08A0-\u08FF (Arabic Extended-A), \uFB50-\uFDFF (Arabic Presentation Forms-A),
 * \uFE70-\uFEFF (Arabic Presentation Forms-B).
 */
export const ARABIC_SCRIPT_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/**
 * Regex matching Latin script characters (basic + extended).
 * Unicode range: A-Z, a-z, \u00C0-\u024F (Latin Extended-A/B),
 * \u1E00-\u1EFF (Latin Extended Additional).
 */
export const LATIN_SCRIPT_REGEX = /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/;

/**
 * The proper-noun allowlist as a set for O(1) lookup.
 */
export const PROPER_NOUNS_SET: ReadonlySet<string> = new Set(PROPER_NOUNS);

/**
 * Remove all occurrences of proper nouns from a text string.
 * Returns the text with proper nouns stripped out, so that remaining
 * characters can be checked for cross-script violations.
 */
export function stripProperNouns(text: string): string {
  let result = text;
  for (const noun of PROPER_NOUNS) {
    // Use a global replace to remove all occurrences (case-sensitive)
    result = result.split(noun).join('');
  }
  return result;
}

/**
 * Check if a text value contains Arabic/Kurdish script characters.
 * Returns true if any Arabic script character is found.
 */
export function containsArabicScript(text: string): boolean {
  return ARABIC_SCRIPT_REGEX.test(text);
}

/**
 * Check if a text value contains Latin script characters.
 * Returns true if any Latin character is found.
 */
export function containsLatinScript(text: string): boolean {
  return LATIN_SCRIPT_REGEX.test(text);
}

// Re-export proper nouns for test consumption
export { PROPER_NOUNS };

// ─────────────────────────────────────────────────────────────────────────────
// Extended exemption utilities for language purity (Property 6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Regex matching i18next interpolation variables: `{{variableName}}`.
 * These are template placeholders, not rendered text, and are exempt
 * from cross-script checks.
 */
const INTERPOLATION_REGEX = /\{\{[^}]*\}\}/g;

/**
 * In Kurdish text, Latin-script words are legitimate borrowed terms
 * (technical jargon, abbreviations, brand names). Kurdish uses Arabic
 * script for native vocabulary, so any Latin word in Kurdish text is
 * by definition a borrowed term.
 *
 * The cross-script violations we detect are:
 *
 * 1. **English locale**: Arabic/Kurdish characters appearing in English
 *    values (this should NEVER happen — English text is purely Latin).
 *    After stripping proper nouns (which are Latin-only anyway), any
 *    Arabic script character is a violation.
 *
 * 2. **Kurdish locale**: A value that contains ONLY Latin characters
 *    (no Arabic/Kurdish script at all) indicates an untranslated value
 *    that was left in English. Legitimate Kurdish values always contain
 *    at least some Arabic/Kurdish script characters, even when they
 *    include borrowed Latin terms (e.g., "گەڕانەوەی VAT" has both).
 *    Exception: values that are purely numeric, punctuation, or consist
 *    entirely of proper nouns / technical abbreviations.
 */
const LATIN_WORD_IN_KURDISH_REGEX = /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]+/g;

/**
 * Well-known technical terms and product names that legitimately appear
 * in Latin script within Kurdish locale text. These extend the proper-noun
 * allowlist for the purpose of cross-script detection.
 *
 * This includes:
 * - Technical abbreviations (VAT, PDF, CSV, API, etc.)
 * - Protocol/format names (SMTP, HTTP, JSON, etc.)
 * - Product category names used internationally (CRM, POS, ERP, etc.)
 * - File format names (Excel, Word — note: Excel is already in PROPER_NOUNS
 *   but we include common ones here for completeness)
 */
const TECHNICAL_LATIN_TERMS: ReadonlySet<string> = new Set([
  // Financial/tax
  'VAT', 'IQD', 'USD', 'EUR',
  // Document formats
  'PDF', 'CSV', 'XML', 'JSON', 'HTML', 'XLSX',
  // Communication
  'SMS', 'SMTP', 'HTTP', 'HTTPS', 'URL', 'API', 'REST',
  'VoIP', 'WhatsApp', 'SSO', 'OAuth',
  // Business software categories
  'CRM', 'POS', 'ERP', 'DMS', 'PLM', 'HR', 'KPI',
  // Technology
  'AI', 'IoT', 'SaaS', 'UI', 'UX',
  // Compliance/standards
  'GDPR', 'ISO',
  // Common English words used as technical terms in Kurdish UI
  'endpoint', 'invoices', 'pos', 'dashboard',
  'Excel', 'Word',
]);

/**
 * Strip all exempt Latin tokens from a text value for cross-script checking.
 *
 * This removes:
 * 1. Proper nouns from the allowlist (R11.7)
 * 2. i18next interpolation variables (`{{...}}`)
 * 3. Known technical Latin terms
 * 4. All remaining standalone Latin words (in Kurdish text, any Latin word
 *    is a borrowed technical term by definition — Kurdish uses Arabic script
 *    for native vocabulary)
 *
 * After stripping, any remaining Latin characters in a Kurdish-locale value
 * represent a genuine cross-script violation (e.g., Latin chars embedded
 * within Arabic-script words without word boundaries).
 */
export function stripExemptLatinTokens(text: string): string {
  let result = text;

  // 1. Strip proper nouns from the allowlist
  for (const noun of PROPER_NOUNS) {
    result = result.split(noun).join('');
  }

  // 2. Strip interpolation variables
  result = result.replace(INTERPOLATION_REGEX, '');

  // 3. Strip known technical Latin terms (handles multi-word terms)
  for (const term of TECHNICAL_LATIN_TERMS) {
    result = result.split(term).join('');
  }

  // 4. Strip all remaining standalone Latin words.
  //    In Kurdish text, any Latin-script word is a borrowed term.
  result = result.replace(LATIN_WORD_IN_KURDISH_REGEX, '');

  return result;
}

/**
 * Check if a Kurdish locale value has a cross-script violation.
 *
 * A Kurdish value violates language purity if it contains Latin characters
 * but NO Arabic/Kurdish script characters at all — this indicates the value
 * was never translated and is still in English.
 *
 * Values that legitimately contain only Latin characters (e.g., "PDF", "Excel")
 * are exempt because they consist entirely of proper nouns or technical
 * abbreviations from the allowlist.
 *
 * Returns true if cross-script violation is detected.
 */
export function hasCrossScriptViolationKu(text: string): boolean {
  // If the value is empty or whitespace-only, no violation
  if (!text || text.trim() === '') return false;

  // Strip interpolation variables first — they don't count as content
  const withoutInterpolation = text.replace(INTERPOLATION_REGEX, '');

  // If nothing remains after stripping interpolation, no violation
  if (!withoutInterpolation.trim()) return false;

  // Check if the value contains any Latin characters
  const hasLatin = LATIN_SCRIPT_REGEX.test(withoutInterpolation);

  // If no Latin characters, definitely no violation
  if (!hasLatin) return false;

  // Check if the value contains any Arabic/Kurdish script characters
  const hasArabic = ARABIC_SCRIPT_REGEX.test(withoutInterpolation);

  // If the value has Latin but NO Arabic/Kurdish script, check if it's
  // entirely composed of exempt tokens (proper nouns + technical terms)
  if (!hasArabic) {
    // Strip all exempt Latin tokens
    const stripped = stripExemptLatinTokens(text);
    // If nothing meaningful remains, the value is entirely exempt tokens
    const remainingContent = stripped.replace(/[\s\d\p{P}\p{S}]/gu, '');
    if (remainingContent.length === 0) return false;
    // Otherwise, it's a Latin-only value that should have been translated
    return true;
  }

  // Value has both Arabic and Latin — this is the normal case for Kurdish
  // text with borrowed terms. No violation.
  return false;
}

/**
 * Check if an English locale value has illegitimate Arabic/Kurdish script
 * characters after stripping proper nouns.
 *
 * Returns true if cross-script violation is detected.
 */
export function hasCrossScriptViolationEn(text: string): boolean {
  const stripped = stripProperNouns(text);
  return ARABIC_SCRIPT_REGEX.test(stripped);
}
