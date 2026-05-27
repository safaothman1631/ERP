/**
 * i18n.config.ts — Phase P5 (Settings + i18n).
 *
 * Sibling configuration for namespace-based, lazy-loaded translations.
 *
 * The legacy `frontend/src/i18n.ts` ships the whole `<lang>.json` file via
 * dynamic import. Per design.md §1.8 and R9.2 / R9.3 we want:
 *
 *   - Only the `common` namespace loaded on first paint, in the active
 *     locale only (no triple-load of inactive languages).
 *   - Other namespaces (`sales`, `inventory`, `pos`, ext modules…) fetched
 *     lazily on first `useTranslation(ns)` call.
 *
 * This file is intentionally a NEW module — it does NOT mutate the legacy
 * `i18n.ts`. The integration step (deferred to a follow-up PR) replaces the
 * App-level import of `./i18n` with `./i18n.config` and removes the legacy
 * file. See `_deltas/P5-deps.md`.
 *
 * Build the per-namespace JSON files with `npm run i18n:split` (see
 * `scripts/i18n-split.mjs`); they land in `frontend/public/locales/<lang>/<ns>.json`.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend, { type HttpBackendOptions } from 'i18next-http-backend';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const SUPPORTED_LANGS = ['ku', 'ar', 'en'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

export const RTL_LANGS: ReadonlySet<SupportedLang> = new Set(['ku', 'ar']);

/**
 * All namespaces produced by `scripts/i18n-split.mjs`. The set MUST stay in
 * sync with the prefixes the splitter recognizes — see the script for the
 * authoritative list.
 */
export const NAMESPACES = [
  'common',
  'auth',
  'nav',
  'dashboard',
  'sales',
  'purchases',
  'inventory',
  'accounting',
  'banking',
  'crm',
  'pos',
  'hr',
  'payroll',
  'manufacturing',
  'projects',
  'reports',
  'settings',
  'errors',
  'validation',
  'iraq',
  // Ext modules — each gets its own namespace, prefixed `ext.<slug>`.
  'ext',
] as const;
export type Namespace = (typeof NAMESPACES)[number];

const LANG_STORAGE_KEY = 'i18n.language';

// ─────────────────────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────────────────────

function getInitialLanguage(): SupportedLang {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored && (SUPPORTED_LANGS as readonly string[]).includes(stored)) {
      return stored as SupportedLang;
    }
  } catch {
    /* ignore */
  }
  return 'ku';
}

// ─────────────────────────────────────────────────────────────────────────────
// Document direction & lang attr
// ─────────────────────────────────────────────────────────────────────────────

function applyDocumentLocale(lang: string): void {
  if (typeof document === 'undefined') return;
  const isRtl = RTL_LANGS.has(lang as SupportedLang);
  document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
}

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────

const initialLang = getInitialLanguage();
applyDocumentLocale(initialLang);

/**
 * Initialize i18next with HTTP backend + lazy namespace loading.
 *
 * Returns the configured `i18n` instance. Callers can `await` the returned
 * promise from `i18n.init()` if they need the initial bundle ready before
 * first render, but most code can just import this module for its
 * side-effects.
 */
export function initI18n(): Promise<typeof i18n> {
  if (i18n.isInitialized) return Promise.resolve(i18n);

  return i18n
    .use(HttpBackend)
    .use(initReactI18next)
    .init<HttpBackendOptions>({
      lng: initialLang,
      fallbackLng: 'en',
      supportedLngs: [...SUPPORTED_LANGS],
      // Load only `common` on first paint; other namespaces fetched on demand
      // by `useTranslation('sales')` etc.
      ns: ['common'],
      defaultNS: 'common',
      load: 'currentOnly', // do NOT preload fallback locale's bundles
      partialBundledLanguages: true,
      backend: {
        loadPath: '/locales/{{lng}}/{{ns}}.json',
        // Cache for an hour client-side; revalidated on deploy via filename hash.
        // (The HTTP backend itself doesn't honor this; the SW does.)
      },
      interpolation: { escapeValue: false },
      returnEmptyString: false,
      react: { useSuspense: false },
    })
    .then(() => i18n);
}

// ─────────────────────────────────────────────────────────────────────────────
// Language change side-effects
// ─────────────────────────────────────────────────────────────────────────────

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lng);
  } catch {
    /* noop */
  }
  applyDocumentLocale(lng);
});

export default i18n;
