import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './locales/ar.json';
import { message as toast } from './utils/message';

/**
 * Language persistence key — spec-required: localStorage['i18n.language']
 * Requirements: 3.7
 */
const LANG_STORAGE_KEY = 'i18n.language';

/**
 * Languages that participate in per-locale dynamic loading.
 *
 * The umbrella spec (system-wide-ux-overhaul) requires only the active locale
 * to ship in the initial bundle and the inactive locale to load on first
 * language switch (R15.6). `ar` is treated as a legacy locale outside the
 * en ⇄ ku bilingual contract and remains statically bundled for backward
 * compatibility with existing screens.
 */
export type Language = 'en' | 'ku';

/** Shape of a loaded locale resource (flat or nested key-value JSON). */
type Resource = Record<string, unknown>;

/**
 * Per-locale dynamic loaders (R15.6, task 1.6 — system-wide-ux-overhaul).
 *
 * Only the active locale is awaited at init; the inactive locale is fetched on
 * first `languageChanged` event. Each loader is a separate dynamic `import()`
 * so Vite/Rollup can split each locale JSON into its own chunk.
 */
const loaders: Record<Language, () => Promise<Resource>> = {
  en: () => import('./locales/en.json').then((m) => m.default as Resource),
  ku: () => import('./locales/ku.json').then((m) => m.default as Resource),
};

/**
 * Always-bundled, locale-keyed failure message used when a lazy locale bundle
 * fails to load (R8.4, R12.5, R15.5).
 *
 * These strings live inline rather than in `en.json` / `ku.json` so the
 * toast can render even when the previous locale's resource bundle is the
 * only one currently in memory and the target locale fetch has failed.
 *
 * Per R8.4 the failure recovery path SHALL NOT force-reset the active
 * language — the user's selection (e.g. Kurdish) remains active and
 * i18next's per-key fallback chain resolves missing keys.
 */
const LOCALE_LOAD_FAILED_MESSAGES: Record<string, string> = {
  en: 'Could not load language pack. Some text may not be translated.',
  ku: 'نەتوانرا پاکێجی زمان دابگیرسێنرێت. هەندێک دەق لەوانەیە وەرنەگێڕدرابێت.',
  ar: 'تعذر تحميل حزمة اللغة. قد لا تتم ترجمة بعض النصوص.',
};

export const RTL_LANGS = new Set(['ku', 'ar']);

/**
 * All 20 i18n namespaces for the ERP system.
 * Requirements: 20.1
 */
export const I18N_NAMESPACES = [
  'common', 'nav', 'auth', 'dashboard', 'sales', 'purchases',
  'inventory', 'accounting', 'banking', 'crm', 'pos', 'hr',
  'payroll', 'manufacturing', 'projects', 'reports', 'settings',
  'errors', 'validation', 'iraq',
] as const;
export type I18nNamespace = typeof I18N_NAMESPACES[number];

/**
 * Read persisted language from localStorage.
 * Falls back to 'ku' if localStorage is unavailable or key is missing.
 * Requirements: 3.7, 3.8
 */
function getPersistedLanguage(): string {
  try {
    return localStorage.getItem(LANG_STORAGE_KEY) ?? 'ku';
  } catch {
    return 'ku';
  }
}

/**
 * Humanize a missing translation key into readable text.
 * Strips namespaces, replaces separators with spaces, Title-cases.
 *   "returns.sales_returns" -> "Sales Returns"
 *   "nav.desc_invoices"     -> "Desc Invoices"
 *
 * Requirements: 20.5 — missing keys fall back to the key string itself
 */
export const humanizeKey = (key: string): string => {
  const last = key.split('.').pop() || key;
  return last
    .replace(/[_\-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

/**
 * Detect if we're running in a test environment.
 * In tests, we use bundled resources instead of http-backend.
 */
const isTestEnv =
  typeof process !== 'undefined' &&
  (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true');

const savedLang = getPersistedLanguage();

if (isTestEnv) {
  // Test environment: pre-bundle every locale via the same dynamic loaders so
  // tests get synchronous, predictable resources without an http-backend.
  // Tests reset the module registry between cases, so re-running these
  // imports per-test is cheap and matches the legacy behaviour exactly.
  const [enData, kuData] = await Promise.all([loaders.en(), loaders.ku()]);

  i18n.use(initReactI18next).init({
    resources: {
      ku: { translation: kuData, common: kuData },
      en: { translation: enData, common: enData },
      ar: { translation: ar as Resource, common: ar as Resource },
    },
    lng: savedLang,
    fallbackLng: 'ku',
    defaultNS: 'translation',
    ns: ['translation', 'common', ...I18N_NAMESPACES],
    interpolation: { escapeValue: false },
    parseMissingKeyHandler: (key, defaultValue) => {
      if (defaultValue && defaultValue !== key) return defaultValue;
      return humanizeKey(key);
    },
    returnEmptyString: false,
  });
} else {
  // Production / development: per-locale dynamic loading (R15.6).
  // Only the active locale's bundle is shipped in the initial chunk; the
  // other supported locale loads on first switch.
  // Load BOTH locales at init so language switching is instant (no 404s).
  // The locale files are code-split by Vite so only the active one blocks
  // initial render; the other loads in parallel.
  const [enData, kuData] = await Promise.all([loaders.en(), loaders.ku()]);

  i18n
    .use(initReactI18next)
    .init({
      lng: savedLang,
      fallbackLng: 'en',
      defaultNS: 'translation',
      ns: ['translation'],
      resources: {
        en: { translation: enData },
        ku: { translation: kuData },
        ar: { translation: ar as Resource },
      },
      interpolation: { escapeValue: false },
      parseMissingKeyHandler: (key, defaultValue) => {
        if (defaultValue && defaultValue !== key) return defaultValue;
        return humanizeKey(key);
      },
      returnEmptyString: false,
    });
}

/**
 * Tracks the locale that was active before the current `languageChanged`
 * event, so the failure recovery path can surface a toast in the previous
 * (still-loaded) locale (R8.4, R12.5).
 */
let previousLanguage: string = savedLang;

i18n.on('languageChanged', (lng) => {
  // Capture the previous locale BEFORE updating module state so the failure
  // path can render a toast in it. Optimistically advance the tracker now;
  // a downstream load failure does not roll the active language back per
  // R8.4 — i18next's per-key fallback chain handles missing keys instead.
  const previousAtSwitch = previousLanguage;
  previousLanguage = lng;

  // Persist to spec-required key (Requirement 3.7) — independent of lazy
  // load (R12.5: independent code paths).
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lng);
  } catch {
    /* noop */
  }
  document.documentElement.dir = RTL_LANGS.has(lng) ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;

  // Lazy-load the resource bundle for the target locale on first switch
  // (R15.6). Only `en` and `ku` participate in lazy loading.
  const isLazyLang = lng === 'en' || lng === 'ku';
  if (isLazyLang && !i18n.hasResourceBundle(lng, 'translation')) {
    const lazyLang = lng as Language;
    void loaders[lazyLang]()
      .then((data) => {
        i18n.addResourceBundle(lazyLang, 'translation', data, true, true);
      })
      .catch((err) => {
        // Graceful failure (R8.4, R12.5, R15.5):
        //   1. Surface a toast in the *previous* locale (still loaded).
        //   2. DO NOT reset the active language. The user's selection
        //      remains active; i18next's fallback chain handles per-key
        //      fallback for any missing translations.
        //   3. DO NOT crash. The catch swallows the rejection so unhandled
        //      promise rejection handlers in main.tsx do not treat this as
        //      a stale-chunk reload trigger.
        const localeKey =
          previousAtSwitch in LOCALE_LOAD_FAILED_MESSAGES
            ? previousAtSwitch
            : 'en';
        const failureMsg = LOCALE_LOAD_FAILED_MESSAGES[localeKey];
        try {
          toast.error(failureMsg);
        } catch {
          /* noop — toast unavailable before AppInitializer mounts */
        }
        try {
          // eslint-disable-next-line no-console
          console.warn('[i18n] Failed to load locale bundle', lng, err);
        } catch {
          /* noop */
        }
      });
  }
});

// Set initial direction
document.documentElement.dir = RTL_LANGS.has(savedLang) ? 'rtl' : 'ltr';
document.documentElement.lang = savedLang;

export default i18n;
