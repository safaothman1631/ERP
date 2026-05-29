/**
 * formatNumber — locale-aware number formatting (R9.5).
 *
 * Companion to `formatCurrency` for non-money numbers. Supports the
 * Arabic-Indic digits user preference.
 */

export interface FormatNumberOptions extends Intl.NumberFormatOptions {
  /** Force Latin (false) or Arabic-Indic (true) digits regardless of locale. */
  arabicIndic?: boolean;
}

function normalizeLocale(locale: string, arabicIndic?: boolean): string {
  let base = locale.startsWith('ku') ? 'ar-IQ' : locale;
  if (arabicIndic === true && !base.includes('-u-nu-')) {
    base = `${base}-u-nu-arab`;
  } else if (arabicIndic === false && !base.includes('-u-nu-')) {
    base = `${base}-u-nu-latn`;
  }
  return base;
}

/**
 * Format a number for display.
 *
 * @example
 *   formatNumber(1234567.89, 'en-US')                      // → '1,234,567.89'
 *   formatNumber(1234567.89, 'de-DE')                      // → '1.234.567,89'
 *   formatNumber(1234, 'ar', { arabicIndic: true })        // → '١٬٢٣٤'
 */
export function formatNumber(
  value: number,
  locale: string,
  options: FormatNumberOptions = {},
): string {
  if (!Number.isFinite(value)) return '';

  const { arabicIndic, ...intlOptions } = options;
  try {
    return new Intl.NumberFormat(normalizeLocale(locale, arabicIndic), intlOptions).format(value);
  } catch {
    try {
      return new Intl.NumberFormat(locale.split('-u-')[0], intlOptions).format(value);
    } catch {
      return String(value);
    }
  }
}

export default formatNumber;
