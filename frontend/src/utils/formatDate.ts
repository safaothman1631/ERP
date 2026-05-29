/**
 * formatDate — locale-aware date formatting (R9.5).
 *
 * Thin wrapper over `Intl.DateTimeFormat` with two ergonomic additions:
 *   1. Accepts `Date | string | number` so call sites don't need to wrap.
 *   2. Normalizes Kurdish (`ku`) to a locale that Intl actually understands
 *      (`ar-IQ`) so users see Arabic-Indic digits and RTL layout.
 *
 * Pass `arabicIndic: false` in `options` (extended) if you want Latin digits
 * even in Arabic / Kurdish contexts.
 */

export interface FormatDateOptions extends Intl.DateTimeFormatOptions {
  /** Force Latin (false) or Arabic-Indic (true) digits regardless of locale. */
  arabicIndic?: boolean;
}

function normalizeLocale(locale: string, arabicIndic?: boolean): string {
  // Kurdish: map to ar-IQ so Intl produces RTL output with sensible defaults.
  let base = locale.startsWith('ku') ? 'ar-IQ' : locale;
  // Append the numbering-system Unicode extension if explicitly requested.
  if (arabicIndic === true && !base.includes('-u-nu-')) {
    base = `${base}-u-nu-arab`;
  } else if (arabicIndic === false && !base.includes('-u-nu-')) {
    base = `${base}-u-nu-latn`;
  }
  return base;
}

function toDate(value: Date | string | number): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Format a date for display in the active locale.
 *
 * @example
 *   formatDate(new Date('2026-05-27'), 'en', { dateStyle: 'long' })
 *   // → 'May 27, 2026'
 *
 *   formatDate(new Date('2026-05-27'), 'ar', { dateStyle: 'long' })
 *   // → '27 مايو 2026'
 */
export function formatDate(
  value: Date | string | number,
  locale: string,
  options: FormatDateOptions = {},
): string {
  const date = toDate(value);
  if (!date) return '';

  const { arabicIndic, ...intlOptions } = options;
  // Default to `dateStyle: 'medium'` if neither dateStyle nor explicit fields given.
  const hasExplicitFields = Object.keys(intlOptions).some((k) =>
    ['year', 'month', 'day', 'hour', 'minute', 'second', 'weekday', 'dateStyle', 'timeStyle'].includes(k),
  );
  const finalOpts: Intl.DateTimeFormatOptions = hasExplicitFields
    ? intlOptions
    : { ...intlOptions, dateStyle: 'medium' };

  try {
    return new Intl.DateTimeFormat(normalizeLocale(locale, arabicIndic), finalOpts).format(date);
  } catch {
    // Locale tag with Unicode extension unsupported by this runtime — retry
    // without the extension.
    try {
      return new Intl.DateTimeFormat(locale.split('-u-')[0], finalOpts).format(date);
    } catch {
      return date.toISOString();
    }
  }
}

export default formatDate;
