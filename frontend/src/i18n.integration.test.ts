/**
 * Integration tests for the i18n system.
 *
 * These tests exercise the full i18n pipeline together — language switching,
 * localStorage persistence, document attribute updates, and missing key
 * handling — as a cohesive system rather than isolated units.
 *
 * Validates: Requirements 4.5, 4.6
 */
import { describe, it, expect, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal localStorage mock that records calls. */
function makeLocalStorageMock(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach((k) => delete store[k]);
    }),
    _store: store,
  };
}

// ---------------------------------------------------------------------------
// 1. Language switching: ku → en → ar (full pipeline)
//    Validates: Requirement 4.5
// ---------------------------------------------------------------------------

describe('Language switching pipeline: ku → en → ar', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    document.documentElement.dir = '';
    document.documentElement.lang = '';
  });

  it('starts in Kurdish with RTL direction and correct lang attribute', async () => {
    const ls = makeLocalStorageMock({ 'i18n.language': 'ku' });
    vi.stubGlobal('localStorage', ls);
    vi.resetModules();

    await import('./i18n');

    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ku');
  });

  it('switching ku → en updates translations, localStorage, dir, and lang atomically', async () => {
    const ls = makeLocalStorageMock({ 'i18n.language': 'ku' });
    vi.stubGlobal('localStorage', ls);
    vi.resetModules();

    const { default: i18n } = await import('./i18n');

    // Verify starting state
    expect(i18n.language).toBe('ku');
    expect(i18n.t('dashboard')).toBe('داشبۆرد');

    // Switch to English
    await i18n.changeLanguage('en');

    // Translation changes
    expect(i18n.t('dashboard')).toBe('Dashboard');
    // localStorage updated
    expect(ls.setItem).toHaveBeenCalledWith('i18n.language', 'en');
    // Document direction changes to LTR
    expect(document.documentElement.dir).toBe('ltr');
    // Document lang attribute updated
    expect(document.documentElement.lang).toBe('en');
  });

  it('switching en → ar updates translations, localStorage, dir, and lang atomically', async () => {
    const ls = makeLocalStorageMock({ 'i18n.language': 'en' });
    vi.stubGlobal('localStorage', ls);
    vi.resetModules();

    const { default: i18n } = await import('./i18n');

    expect(i18n.language).toBe('en');

    // Switch to Arabic
    await i18n.changeLanguage('ar');

    // localStorage updated
    expect(ls.setItem).toHaveBeenCalledWith('i18n.language', 'ar');
    // Arabic is RTL
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('full sequence ku → en → ar produces correct final state', async () => {
    const ls = makeLocalStorageMock({ 'i18n.language': 'ku' });
    vi.stubGlobal('localStorage', ls);
    vi.resetModules();

    const { default: i18n } = await import('./i18n');

    // Step 1: ku (initial)
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ku');

    // Step 2: switch to en
    await i18n.changeLanguage('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
    expect(i18n.t('dashboard')).toBe('Dashboard');

    // Step 3: switch to ar
    await i18n.changeLanguage('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');

    // localStorage reflects the last language set
    const setItemCalls = ls.setItem.mock.calls.filter(
      ([key]: [string]) => key === 'i18n.language'
    );
    expect(setItemCalls.at(-1)).toEqual(['i18n.language', 'ar']);
  });

  it('switching back from ar → ku restores RTL and Kurdish translations', async () => {
    const ls = makeLocalStorageMock({ 'i18n.language': 'ar' });
    vi.stubGlobal('localStorage', ls);
    vi.resetModules();

    const { default: i18n } = await import('./i18n');

    await i18n.changeLanguage('ku');

    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ku');
    expect(i18n.t('dashboard')).toBe('داشبۆرد');
    expect(ls.setItem).toHaveBeenCalledWith('i18n.language', 'ku');
  });
});

// ---------------------------------------------------------------------------
// 2. RTL/LTR direction changes across all supported languages
//    Validates: Requirement 4.5
// ---------------------------------------------------------------------------

describe('RTL/LTR direction changes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    document.documentElement.dir = '';
    document.documentElement.lang = '';
  });

  it.each([
    { lang: 'ku', expectedDir: 'rtl' },
    { lang: 'ar', expectedDir: 'rtl' },
    { lang: 'en', expectedDir: 'ltr' },
  ])('language "$lang" sets dir="$expectedDir" on init', async ({ lang, expectedDir }) => {
    const ls = makeLocalStorageMock({ 'i18n.language': lang });
    vi.stubGlobal('localStorage', ls);
    vi.resetModules();

    await import('./i18n');

    expect(document.documentElement.dir).toBe(expectedDir);
  });

  it.each([
    { from: 'en', to: 'ku', expectedDir: 'rtl' },
    { from: 'en', to: 'ar', expectedDir: 'rtl' },
    { from: 'ku', to: 'en', expectedDir: 'ltr' },
    { from: 'ar', to: 'en', expectedDir: 'ltr' },
    { from: 'ku', to: 'ar', expectedDir: 'rtl' },
    { from: 'ar', to: 'ku', expectedDir: 'rtl' },
  ])(
    'switching from "$from" to "$to" sets dir="$expectedDir"',
    async ({ from, to, expectedDir }) => {
      const ls = makeLocalStorageMock({ 'i18n.language': from });
      vi.stubGlobal('localStorage', ls);
      vi.resetModules();

      const { default: i18n } = await import('./i18n');
      await i18n.changeLanguage(to);

      expect(document.documentElement.dir).toBe(expectedDir);
    }
  );

  it('dir and lang attributes are always in sync after language change', async () => {
    const ls = makeLocalStorageMock({ 'i18n.language': 'ku' });
    vi.stubGlobal('localStorage', ls);
    vi.resetModules();

    const { default: i18n } = await import('./i18n');

    const languages = ['en', 'ar', 'ku', 'en'];
    const expectedDirs: Record<string, string> = { ku: 'rtl', ar: 'rtl', en: 'ltr' };

    for (const lang of languages) {
      await i18n.changeLanguage(lang);
      expect(document.documentElement.lang).toBe(lang);
      expect(document.documentElement.dir).toBe(expectedDirs[lang]);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Missing key handling via parseMissingKeyHandler
//    Validates: Requirement 4.6
// ---------------------------------------------------------------------------

describe('Missing key handling — full i18n pipeline', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    document.documentElement.dir = '';
    document.documentElement.lang = '';
  });

  it('humanizes a missing key in English context', async () => {
    const ls = makeLocalStorageMock({ 'i18n.language': 'en' });
    vi.stubGlobal('localStorage', ls);
    vi.resetModules();

    const { default: i18n } = await import('./i18n');
    await i18n.changeLanguage('en');

    const result = i18n.t('returns.sales_returns');
    expect(result).toBe('Sales Returns');
    expect(result).not.toBe('returns.sales_returns');
  });

  it('humanizes a missing key in Kurdish context', async () => {
    const ls = makeLocalStorageMock({ 'i18n.language': 'ku' });
    vi.stubGlobal('localStorage', ls);
    vi.resetModules();

    const { default: i18n } = await import('./i18n');

    // A key that doesn't exist in any locale
    const result = i18n.t('settings.missing_config_key');
    expect(result).toBe('Missing Config Key');
    expect(result).not.toBe('settings.missing_config_key');
  });

  it('humanizes a missing key in Arabic context', async () => {
    const ls = makeLocalStorageMock({ 'i18n.language': 'ar' });
    vi.stubGlobal('localStorage', ls);
    vi.resetModules();

    const { default: i18n } = await import('./i18n');
    await i18n.changeLanguage('ar');

    const result = i18n.t('nav.desc_invoices');
    expect(result).toBe('Desc Invoices');
    expect(result).not.toBe('nav.desc_invoices');
  });

  it('missing key handler produces consistent output regardless of active language', async () => {
    const ls = makeLocalStorageMock({ 'i18n.language': 'ku' });
    vi.stubGlobal('localStorage', ls);
    vi.resetModules();

    const { default: i18n } = await import('./i18n');

    const missingKey = 'some.deeply.nested.my_feature_flag';

    await i18n.changeLanguage('ku');
    const resultKu = i18n.t(missingKey);

    await i18n.changeLanguage('en');
    const resultEn = i18n.t(missingKey);

    await i18n.changeLanguage('ar');
    const resultAr = i18n.t(missingKey);

    // All three should produce the same humanized output
    expect(resultKu).toBe('My Feature Flag');
    expect(resultEn).toBe('My Feature Flag');
    expect(resultAr).toBe('My Feature Flag');
  });

  it('does not return the raw key for any missing key across all languages', async () => {
    const ls = makeLocalStorageMock({ 'i18n.language': 'en' });
    vi.stubGlobal('localStorage', ls);
    vi.resetModules();

    const { default: i18n } = await import('./i18n');

    const missingKeys = [
      'module.some_missing_key',
      'a.b.c.deep_key',
      'camelCaseKey',
      'hyphen-key',
    ];

    for (const lang of ['ku', 'en', 'ar']) {
      await i18n.changeLanguage(lang);
      for (const key of missingKeys) {
        const result = i18n.t(key);
        expect(result).not.toBe(key);
        expect(result.length).toBeGreaterThan(0);
      }
    }
  });

  it('returns actual translation (not humanized) for keys that exist', async () => {
    const ls = makeLocalStorageMock({ 'i18n.language': 'en' });
    vi.stubGlobal('localStorage', ls);
    vi.resetModules();

    const { default: i18n } = await import('./i18n');
    await i18n.changeLanguage('en');

    // "dashboard" exists in en.json as "Dashboard"
    const result = i18n.t('dashboard');
    expect(result).toBe('Dashboard');
  });
});

// ---------------------------------------------------------------------------
// 4. Persistence: saved language is restored on next "app load"
//    Validates: Requirement 4.3
// ---------------------------------------------------------------------------

describe('Language persistence across simulated app reloads', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    document.documentElement.dir = '';
    document.documentElement.lang = '';
  });

  it('restores English from localStorage on init', async () => {
    const ls = makeLocalStorageMock({ 'i18n.language': 'en' });
    vi.stubGlobal('localStorage', ls);
    vi.resetModules();

    const { default: i18n } = await import('./i18n');

    expect(i18n.language).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
  });

  it('restores Arabic from localStorage on init', async () => {
    const ls = makeLocalStorageMock({ 'i18n.language': 'ar' });
    vi.stubGlobal('localStorage', ls);
    vi.resetModules();

    const { default: i18n } = await import('./i18n');

    expect(i18n.language).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('defaults to Kurdish when localStorage has no saved language', async () => {
    const ls = makeLocalStorageMock({});
    vi.stubGlobal('localStorage', ls);
    vi.resetModules();

    const { default: i18n } = await import('./i18n');

    expect(i18n.language).toBe('ku');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ku');
  });

  it('language change persists the new language for the next simulated load', async () => {
    // First "session": start with ku, switch to en
    const ls = makeLocalStorageMock({ 'i18n.language': 'ku' });
    vi.stubGlobal('localStorage', ls);
    vi.resetModules();

    const { default: i18n } = await import('./i18n');
    await i18n.changeLanguage('en');

    // Verify localStorage was updated
    expect(ls._store['i18n.language']).toBe('en');

    // Second "session": simulate reload by re-importing with the updated store
    vi.resetModules();
    const ls2 = makeLocalStorageMock({ 'i18n.language': ls._store['i18n.language'] });
    vi.stubGlobal('localStorage', ls2);

    const { default: i18n2 } = await import('./i18n');
    expect(i18n2.language).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
  });
});
