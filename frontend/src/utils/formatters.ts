/**
 * formatters.ts — locale-aware formatting utilities
 *
 * Provides:
 *   - formatMoney()    — currency formatting for IQD/USD/EUR (ku + en)
 *   - formatCurrency() — alias / extended version of formatMoney
 *   - formatDate()     — date formatting respecting user locale
 *   - formatNumber()   — number formatting with locale separators
 *   - formatTime()     — time formatting (12h / 24h)
 *
 * Requirements: 18.1, 18.2, 18.3, 18.4
 */
import i18n from '../i18n';
import { useSettingsStore } from '../store/settingsStore';

function getFormats() {
  try {
    return useSettingsStore.getState().config.formats;
  } catch {
    return null;
  }
}

function getCurrency() {
  try {
    return useSettingsStore.getState().config.payment_methods.default_currency || 'IQD';
  } catch {
    return 'IQD';
  }
}

function localeFromI18n(): string {
  const lang = i18n.language || 'en';
  if (lang.startsWith('ku')) return 'ckb-IQ';
  if (lang.startsWith('ar')) return 'ar-IQ';
  return 'en-US';
}

/**
 * formatMoney — primary money formatter for the ERP system.
 *
 * Formats a monetary amount with the correct locale and currency symbol.
 * - Kurdish (ku): uses 'ar-IQ' locale (Arabic-Iraq number formatting, RTL)
 * - English (en): uses 'en-US' locale
 *
 * @param amount       - The numeric amount to format
 * @param currency     - ISO 4217 currency code (default: 'IQD')
 * @returns            - Formatted string, e.g. "IQD 1,250,000.00" or "١٬٢٥٠٬٠٠٠٫٠٠ د.ع.‏"
 *
 * Requirements: 18.3, 18.4
 */
export function formatMoney(amount: number, currency = 'IQD'): string {
  const locale = localeFromI18n();
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback: manual formatting if Intl fails (e.g. unsupported currency)
    const fmt = getFormats();
    const sep = fmt?.thousand_sep || ',';
    const dec = fmt?.decimal_sep || '.';
    const parts = amount.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, sep);
    return `${currency} ${parts.join(dec)}`;
  }
}

export function formatCurrency(amount: number, currencyCode?: string): string {
  const code = currencyCode || getCurrency();
  const fmt = getFormats();
  try {
    const opts: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    };
    return new Intl.NumberFormat(localeFromI18n(), opts).format(amount);
  } catch {
    const sep = fmt?.thousand_sep || ',';
    const dec = fmt?.decimal_sep || '.';
    const parts = amount.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, sep);
    return `${parts.join(dec)} ${code}`;
  }
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);
  const fmt = getFormats();
  if (options) {
    try { return new Intl.DateTimeFormat(localeFromI18n(), options).format(d); } catch { /* ignore */ }
  }
  // Apply user-selected format token (subset)
  const token = fmt?.date_format || 'YYYY-MM-DD';
  const yyyy = String(d.getFullYear()).padStart(4, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const monthShort = d.toLocaleString(localeFromI18n(), { month: 'short' });
  switch (token) {
    case 'DD/MM/YYYY': return `${dd}/${mm}/${yyyy}`;
    case 'MM/DD/YYYY': return `${mm}/${dd}/${yyyy}`;
    case 'DD MMM YYYY': return `${dd} ${monthShort} ${yyyy}`;
    case 'YYYY-MM-DD':
    default: return `${yyyy}-${mm}-${dd}`;
  }
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  if (value === null || value === undefined || isNaN(value)) return '';
  const fmt = getFormats();
  try {
    return new Intl.NumberFormat(localeFromI18n(), options).format(value);
  } catch {
    const sep = fmt?.thousand_sep || ',';
    const dec = fmt?.decimal_sep || '.';
    const [int, frac] = value.toString().split('.');
    const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
    return frac ? `${intFmt}${dec}${frac}` : intFmt;
  }
}

export function formatTime(date: string | Date): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);
  const fmt = getFormats();
  const hh = d.getHours();
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (fmt?.time_format === '12h') {
    const period = hh >= 12 ? 'PM' : 'AM';
    const h12 = ((hh + 11) % 12) + 1;
    return `${h12}:${mm} ${period}`;
  }
  return `${String(hh).padStart(2, '0')}:${mm}`;
}
