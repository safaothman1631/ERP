import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ku from './locales/ku.json';
import en from './locales/en.json';
import ar from './locales/ar.json';

const savedLang = localStorage.getItem('app_language') || 'ku';
const RTL_LANGS = new Set(['ku', 'ar']);

/**
 * Humanize a missing translation key into readable text.
 * Strips namespaces, replaces separators with spaces, Title-cases.
 *   "returns.sales_returns" -> "Sales Returns"
 *   "nav.desc_invoices"     -> "Desc Invoices"
 */
const humanizeKey = (key: string): string => {
  const last = key.split('.').pop() || key;
  return last
    .replace(/[_\-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

i18n.use(initReactI18next).init({
  resources: {
    ku: { translation: ku },
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: savedLang,
  fallbackLng: 'ku',
  interpolation: { escapeValue: false },
  // Never display raw keys like "returns.sales_returns" — always humanize.
  parseMissingKeyHandler: (key, defaultValue) => {
    if (defaultValue && defaultValue !== key) return defaultValue;
    return humanizeKey(key);
  },
  returnEmptyString: false,
});

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('app_language', lng);
  document.documentElement.dir = RTL_LANGS.has(lng) ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;
});

// Set initial direction
document.documentElement.dir = RTL_LANGS.has(savedLang) ? 'rtl' : 'ltr';
document.documentElement.lang = savedLang;

export default i18n;
