/**
 * format.ts — Locale-aware formatting utilities for the UI redesign
 *
 * Provides:
 *   - formatMoney()  — currency formatting using Intl.NumberFormat
 *                      ar-IQ for IQD/Kurdish/Arabic, en-US for USD/English
 *   - formatDate()   — date formatting using dayjs with correct locale per language
 *
 * Requirements: 10.4, 10.5, 20.6
 */

import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import 'dayjs/locale/en';
// Kurdish Sorani is not natively in dayjs; we use 'ar' as the closest RTL locale
// and fall back to 'en' for formatting patterns.

import type { Language } from './language';

/**
 * Maps a Language to the Intl locale string for number/currency formatting.
 * - Kurdish (ku) and Arabic (ar) use 'ar-IQ' (Arabic-Iraq)
 * - English (en) uses 'en-US'
 *
 * Requirements: 10.4, 20.6
 */
function getIntlLocale(lang: Language): string {
  if (lang === 'ku' || lang === 'ar') return 'ar-IQ';
  return 'en-US';
}

/**
 * Maps a Language to the dayjs locale string.
 * - Kurdish (ku) → 'ar' (closest available RTL locale in dayjs)
 * - Arabic (ar)  → 'ar'
 * - English (en) → 'en'
 *
 * Requirements: 10.5
 */
function getDayjsLocale(lang: Language): string {
  if (lang === 'ku' || lang === 'ar') return 'ar';
  return 'en';
}

/**
 * formatMoney — formats a monetary amount with locale-aware number formatting.
 *
 * - IQD with Kurdish or Arabic: uses 'ar-IQ' locale (Arabic-Iraq numerals)
 * - USD with English: uses 'en-US' locale
 * - IQD with English: uses 'en-US' locale
 * - USD with Kurdish or Arabic: uses 'ar-IQ' locale
 *
 * @param amount   - The numeric amount to format
 * @param currency - ISO 4217 currency code ('IQD' | 'USD'), defaults to 'IQD'
 * @param lang     - The active language, defaults to 'ku'
 * @returns        - Formatted currency string
 *
 * Requirements: 10.4, 20.6
 */
export function formatMoney(
  amount: number,
  currency: 'IQD' | 'USD' | string = 'IQD',
  lang: Language = 'ku',
): string {
  const locale = getIntlLocale(lang);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Fallback: plain number formatting if currency code is unsupported
    try {
      const formatted = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
      return `${currency} ${formatted}`;
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  }
}

/**
 * formatDate — formats a date using dayjs with the correct locale per language.
 *
 * @param date   - A Date object, ISO string, or dayjs-compatible value
 * @param lang   - The active language, defaults to 'ku'
 * @param format - Optional dayjs format string (defaults to 'DD/MM/YYYY')
 * @returns      - Formatted date string, or empty string for invalid dates
 *
 * Requirements: 10.5
 */
export function formatDate(
  date: Date | string | number | null | undefined,
  lang: Language = 'ku',
  format = 'DD/MM/YYYY',
): string {
  if (date === null || date === undefined || date === '') return '';
  const locale = getDayjsLocale(lang);
  const d = dayjs(date).locale(locale);
  if (!d.isValid()) return '';
  return d.format(format);
}

/**
 * formatNumber — formats a plain number with locale-aware separators.
 *
 * @param value  - The numeric value to format
 * @param lang   - The active language, defaults to 'ku'
 * @param opts   - Optional Intl.NumberFormatOptions
 * @returns      - Formatted number string
 */
export function formatNumber(
  value: number,
  lang: Language = 'ku',
  opts?: Intl.NumberFormatOptions,
): string {
  const locale = getIntlLocale(lang);
  try {
    return new Intl.NumberFormat(locale, opts).format(value);
  } catch {
    return String(value);
  }
}
