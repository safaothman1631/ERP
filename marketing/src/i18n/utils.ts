/**
 * i18n utilities for the marketing site.
 *
 * Three locales supported:
 *   - ku (Kurdish Sorani, default, RTL)
 *   - en (English, LTR)
 *   - ar (Arabic, RTL)
 *
 * URL conventions:
 *   - `/` → ku default landing (e.g. /, /pricing, /features)
 *   - `/en/...` → English variants
 *   - `/ar/...` → Arabic variants
 */

import kuStrings from './ku.json';
import enStrings from './en.json';
import arStrings from './ar.json';

export type Locale = 'ku' | 'en' | 'ar';
export const SUPPORTED_LOCALES: readonly Locale[] = ['ku', 'en', 'ar'] as const;
export const DEFAULT_LOCALE: Locale = 'ku';
export const RTL_LOCALES: readonly Locale[] = ['ku', 'ar'] as const;

const STRINGS: Record<Locale, Record<string, string>> = {
  ku: kuStrings as Record<string, string>,
  en: enStrings as Record<string, string>,
  ar: arStrings as Record<string, string>,
};

/**
 * Get directionality for a locale ('rtl' | 'ltr').
 */
export function dir(locale: Locale): 'rtl' | 'ltr' {
  return RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
}

/**
 * Get the HTML lang attribute value (BCP 47).
 */
export function langAttr(locale: Locale): string {
  switch (locale) {
    case 'ku':
      return 'ckb-IQ'; // Central Kurdish (Sorani) — Iraq
    case 'ar':
      return 'ar-IQ';
    case 'en':
      return 'en-US';
  }
}

/**
 * Detect locale from a URL pathname.
 * Returns DEFAULT_LOCALE if no locale prefix is present.
 */
export function localeFromPath(pathname: string): Locale {
  const seg = pathname.split('/').filter(Boolean)[0];
  if (seg === 'en' || seg === 'ar' || seg === 'ku') {
    return seg;
  }
  return DEFAULT_LOCALE;
}

/**
 * Strip the locale prefix from a path.
 *   /en/pricing → /pricing
 *   /ar/        → /
 *   /pricing    → /pricing
 */
export function stripLocale(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'en' || parts[0] === 'ar' || parts[0] === 'ku') {
    parts.shift();
  }
  return '/' + parts.join('/');
}

/**
 * Build a locale-prefixed URL from a bare path.
 *   ('en', '/pricing') → '/en/pricing'
 *   ('ku', '/pricing') → '/pricing'  (default is root)
 *   ('ar', '/')        → '/ar'
 */
export function localizedPath(locale: Locale, path: string): string {
  const cleanPath = path.startsWith('/') ? path : '/' + path;
  if (locale === DEFAULT_LOCALE) {
    return cleanPath === '/' ? '/' : cleanPath;
  }
  if (cleanPath === '/') return `/${locale}`;
  return `/${locale}${cleanPath}`;
}

/**
 * Generate alternate URLs for all locales of the current page.
 * Used for hreflang link tags.
 */
export function alternateUrls(
  currentPath: string,
  siteUrl = 'https://zoho-kurdish.iq'
): Array<{ locale: Locale; href: string; hreflang: string }> {
  const bare = stripLocale(currentPath);
  return SUPPORTED_LOCALES.map((loc) => ({
    locale: loc,
    href: `${siteUrl}${localizedPath(loc, bare)}`,
    hreflang: langAttr(loc),
  }));
}

/**
 * Translate a key for a given locale. Returns the key itself as fallback.
 * Supports nested keys via dot notation: t('nav.pricing', 'ku')
 */
export function t(key: string, locale: Locale, fallback?: string): string {
  const dict = STRINGS[locale] ?? STRINGS[DEFAULT_LOCALE];
  const direct = dict[key];
  if (direct !== undefined) return direct;
  // try fallback locale
  if (locale !== DEFAULT_LOCALE) {
    const fb = STRINGS[DEFAULT_LOCALE][key];
    if (fb !== undefined) return fb;
  }
  return fallback ?? key;
}

/**
 * Build a translator bound to one locale (used heavily in components).
 */
export function tt(locale: Locale): (key: string, fallback?: string) => string {
  return (key, fallback) => t(key, locale, fallback);
}

/**
 * Format a number for the locale (Western digits for en, optional Arabic-Indic for ar/ku).
 * For now we use Western digits everywhere (per UI consistency); the in-app setting controls invoice rendering.
 */
export function fmtNumber(n: number, locale: Locale): string {
  const tag = locale === 'ku' ? 'ar-IQ' : langAttr(locale);
  try {
    return new Intl.NumberFormat(tag, { maximumFractionDigits: 0 }).format(n);
  } catch {
    return String(n);
  }
}

/**
 * Format IQD price.
 *   ku/ar: "75,000 د.ع"
 *   en:    "IQD 75,000"
 */
export function fmtIQD(n: number, locale: Locale): string {
  const num = fmtNumber(n, locale);
  if (locale === 'en') return `IQD ${num}`;
  return `${num} د.ع`;
}

/**
 * Format USD price (used as secondary on pricing page).
 */
export function fmtUSD(n: number, locale: Locale): string {
  const num = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(n);
  if (locale === 'en') return `$${num}`;
  return `$${num}`; // dollar sign reads the same in all three locales
}
