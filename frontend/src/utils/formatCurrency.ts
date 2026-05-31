/**
 * formatCurrency — locale-aware currency formatting (R9.5).
 *
 * Wraps `Intl.NumberFormat` with sensible defaults plus overrides for
 * currencies the standard tables get wrong for our market:
 *
 *   - IQD (Iraqi Dinar): no decimals, suffix `د.ع` rendered in the locale's
 *     natural script direction. Intl in many browsers prints `IQD` rather
 *     than the local symbol; we override that.
 *
 * Pluggable: add an entry to `CURRENCY_OVERRIDES` to teach the formatter
 * about a new currency without touching call sites.
 *
 * @param value     The numeric amount (in major units, e.g. 1234.5).
 * @param currency  ISO 4217 currency code (e.g. 'IQD', 'USD').
 * @param locale    BCP 47 locale tag (e.g. 'ku', 'ar', 'en-US'). Locale `ku`
 *                  is treated as Kurdish (Sorani) with Arabic-Indic digits
 *                  by default; pass `ku-IQ-u-nu-latn` for Latin digits.
 */

export interface CurrencyOverride {
  /** Per-locale symbol/suffix; key is BCP 47 locale prefix. */
  symbol: Partial<Record<string, string>>;
  /** Default symbol if no locale matches. */
  defaultSymbol: string;
  /** Decimal digits to use. */
  decimals: number;
  /** Whether the symbol comes after the number (default) or before. */
  position: 'prefix' | 'suffix';
}

/**
 * Currency-specific overrides. Add new currencies here; everything else
 * falls back to native `Intl.NumberFormat({ style: 'currency' })`.
 */
export const CURRENCY_OVERRIDES: Record<string, CurrencyOverride> = {
  IQD: {
    symbol: { ar: 'د.ع', ku: 'د.ع', fa: 'د.ع' },
    defaultSymbol: 'IQD',
    decimals: 0,
    position: 'suffix',
  },
};

/** Map a Kurdish or Arabic locale to one Intl actually knows. */
function normalizeLocale(locale: string): string {
  // ku and ku-* are not in CLDR everywhere; ar-IQ is the closest cousin
  // that yields RTL number layout + Arabic-Indic digits when the locale
  // explicitly enables `-u-nu-arab`.
  if (locale.startsWith('ku')) return 'ar-IQ';
  return locale;
}

/** Locale prefix used to pick a symbol from `CurrencyOverride.symbol`. */
function localePrefix(locale: string): string {
  return locale.split(/[-_]/)[0];
}

/**
 * Format a number as a currency string for display.
 */
export function formatCurrency(value: number, currency: string, locale: string): string {
  if (!Number.isFinite(value)) return '';

  const override = CURRENCY_OVERRIDES[currency.toUpperCase()];

  if (override) {
    const nf = new Intl.NumberFormat(normalizeLocale(locale), {
      minimumFractionDigits: override.decimals,
      maximumFractionDigits: override.decimals,
      useGrouping: true,
    });
    const number = nf.format(value);
    const symbol =
      override.symbol[localePrefix(locale)] ?? override.defaultSymbol;
    // NB: we deliberately use a NO-BREAK SPACE (\u00a0) between number and
    // symbol so RTL layout doesn't break the pair across lines.
    return override.position === 'prefix'
      ? `${symbol}\u00a0${number}`
      : `${number}\u00a0${symbol}`;
  }

  try {
    return new Intl.NumberFormat(normalizeLocale(locale), {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(value);
  } catch {
    // Unknown currency code — best-effort fallback.
    return `${value.toFixed(2)} ${currency}`;
  }
}

export default formatCurrency;
