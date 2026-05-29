/**
 * Arabic-Indic digit utilities (growth-to-100 § R4.8).
 *
 * Tenant-level option: Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) on official
 * documents instead of Latin (0123456789).
 *
 * These helpers extend the existing `formatNumber` / `formatCurrency` /
 * `formatDate` utilities — they do not replace them. Components either:
 *
 *   1. Read `useDigitPreference()` and pass `arabicIndic: true|false`
 *      to the existing formatter; OR
 *   2. Call `formatNumberDigits(s, useArabicIndic)` to post-process an
 *      already-formatted string.
 *
 * Default per locale: Arabic → Arabic-Indic; Kurdish/English → Latin.
 */

const LATIN_DIGITS = '0123456789';
const INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

const LATIN_TO_INDIC = new Map<string, string>();
const INDIC_TO_LATIN = new Map<string, string>();
for (let i = 0; i < 10; i += 1) {
  LATIN_TO_INDIC.set(LATIN_DIGITS[i]!, INDIC_DIGITS[i]!);
  INDIC_TO_LATIN.set(INDIC_DIGITS[i]!, LATIN_DIGITS[i]!);
}

/**
 * Convert every Latin digit (0–9) in `text` to its Arabic-Indic
 * counterpart (٠–٩). Non-digit characters are left untouched.
 */
export function toArabicIndic(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  const str = String(text);
  let out = '';
  for (const ch of str) out += LATIN_TO_INDIC.get(ch) ?? ch;
  return out;
}

/** Reverse — Arabic-Indic → Latin. Used to normalise user input. */
export function toLatin(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  const str = String(text);
  let out = '';
  for (const ch of str) out += INDIC_TO_LATIN.get(ch) ?? ch;
  return out;
}

/**
 * Format a number with optional Arabic-Indic digits.
 *
 * Wraps the existing `formatNumber` utility — callers should generally use
 * that directly with `{ arabicIndic: true }`. This helper exists for when
 * an already-formatted string needs post-processing (e.g. a third-party
 * library returned Latin digits in an Arabic context).
 */
export function formatNumberDigits(
  value: number | string,
  useArabicIndic: boolean,
): string {
  const str = String(value);
  return useArabicIndic ? toArabicIndic(str) : toLatin(str);
}

/**
 * Default preference for a given locale. Used when the tenant hasn't
 * explicitly chosen one in their settings.
 *
 * Iraqi practice: Arabic locale → Indic; Kurdish and English → Latin.
 */
export function defaultDigitPreference(locale: string): boolean {
  return locale.startsWith('ar');
}

const arabicDigits = {
  toArabicIndic,
  toLatin,
  formatNumberDigits,
  defaultDigitPreference,
};

export default arabicDigits;
