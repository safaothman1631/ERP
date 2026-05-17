/**
 * Unit tests for the i18n configuration system.
 *
 * Validates:
 *   - Three language support: Kurdish (ku), Arabic (ar), English (en)
 *   - RTL direction for Kurdish and Arabic
 *   - Missing key handler that humanizes translation keys
 *   - Default language is Kurdish ("ku")
 *   - Language persistence via localStorage key "app_language"
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// humanizeKey — isolated unit tests (Requirement 4.6)
// ---------------------------------------------------------------------------

describe('humanizeKey — missing key handler', () => {
  // We import after mocking localStorage to avoid side-effects from i18n init
  let humanizeKey: (key: string) => string;

  beforeEach(async () => {
    // Provide a minimal localStorage mock so i18n.ts can initialise
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    // Reset module registry so each test group gets a fresh import
    vi.resetModules();
    const mod = await import('./i18n');
    humanizeKey = mod.humanizeKey;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('strips namespace prefix and title-cases the last segment', () => {
    expect(humanizeKey('returns.sales_returns')).toBe('Sales Returns');
  });

  it('converts underscores to spaces and title-cases', () => {
    expect(humanizeKey('nav.desc_invoices')).toBe('Desc Invoices');
  });

  it('handles a plain key with no namespace', () => {
    expect(humanizeKey('dashboard')).toBe('Dashboard');
  });

  it('handles camelCase by inserting spaces', () => {
    expect(humanizeKey('some.camelCaseKey')).toBe('Camel Case Key');
  });

  it('handles hyphenated keys', () => {
    expect(humanizeKey('section.my-feature-flag')).toBe('My Feature Flag');
  });

  it('handles deeply nested keys — uses only the last segment', () => {
    expect(humanizeKey('a.b.c.my_setting')).toBe('My Setting');
  });

  it('returns a non-empty string for any non-empty key', () => {
    const keys = ['x', 'a.b', 'foo_bar', 'some.nested.key'];
    keys.forEach((k) => {
      expect(humanizeKey(k).length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// RTL_LANGS — which languages trigger RTL (Requirements 4.1, 4.5)
// ---------------------------------------------------------------------------

describe('RTL_LANGS set', () => {
  let RTL_LANGS: Set<string>;

  beforeEach(async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    vi.resetModules();
    const mod = await import('./i18n');
    RTL_LANGS = mod.RTL_LANGS;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('includes Kurdish (ku)', () => {
    expect(RTL_LANGS.has('ku')).toBe(true);
  });

  it('includes Arabic (ar)', () => {
    expect(RTL_LANGS.has('ar')).toBe(true);
  });

  it('does NOT include English (en)', () => {
    expect(RTL_LANGS.has('en')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// i18n instance — language support and configuration (Requirements 4.1–4.5)
// ---------------------------------------------------------------------------

describe('i18n instance configuration', () => {
  let i18n: Awaited<ReturnType<typeof import('./i18n')>>['default'];

  beforeEach(async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    vi.resetModules();
    const mod = await import('./i18n');
    i18n = mod.default;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has Kurdish (ku) as a registered language (Requirement 4.1)', () => {
    expect(i18n.hasResourceBundle('ku', 'translation')).toBe(true);
  });

  it('has Arabic (ar) as a registered language (Requirement 4.1)', () => {
    expect(i18n.hasResourceBundle('ar', 'translation')).toBe(true);
  });

  it('has English (en) as a registered language (Requirement 4.1)', () => {
    expect(i18n.hasResourceBundle('en', 'translation')).toBe(true);
  });

  it('defaults to Kurdish (ku) when no language is saved (Requirement 4.4)', () => {
    expect(i18n.language).toBe('ku');
  });

  it('uses Kurdish (ku) as fallback language', () => {
    // i18next stores fallbackLng as an array internally
    const fallback = i18n.options.fallbackLng;
    const fallbackArr = Array.isArray(fallback) ? fallback : [fallback];
    expect(fallbackArr).toContain('ku');
  });

  it('translates a known key in Kurdish', () => {
    i18n.changeLanguage('ku');
    // "dashboard" is a key present in ku.json
    const result = i18n.t('dashboard');
    expect(result).toBe('داشبۆرد');
  });

  it('translates a known key in English', async () => {
    await i18n.changeLanguage('en');
    const result = i18n.t('dashboard');
    expect(result).toBe('Dashboard');
  });

  it('humanizes a missing key instead of returning the raw key (Requirement 4.6)', async () => {
    await i18n.changeLanguage('en');
    const result = i18n.t('some.missing_key_here');
    // Should be humanized, not the raw key
    expect(result).not.toBe('some.missing_key_here');
    expect(result).toBe('Missing Key Here');
  });
});

// ---------------------------------------------------------------------------
// localStorage persistence (Requirement 4.3)
// ---------------------------------------------------------------------------

describe('language persistence via localStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('reads saved language from localStorage key "app_language" on init (Requirement 4.3)', async () => {
    const mockGetItem = vi.fn().mockReturnValue('en');
    vi.stubGlobal('localStorage', {
      getItem: mockGetItem,
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    vi.resetModules();
    const mod = await import('./i18n');
    expect(mockGetItem).toHaveBeenCalledWith('app_language');
    expect(mod.default.language).toBe('en');
  });

  it('saves language to localStorage when language changes (Requirement 4.5)', async () => {
    const mockSetItem = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue(null),
      setItem: mockSetItem,
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    vi.resetModules();
    const mod = await import('./i18n');
    await mod.default.changeLanguage('en');
    expect(mockSetItem).toHaveBeenCalledWith('app_language', 'en');
  });
});

// ---------------------------------------------------------------------------
// RTL direction on document (Requirement 4.5)
// ---------------------------------------------------------------------------

describe('document direction on language change', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    // Reset document dir
    document.documentElement.dir = '';
    document.documentElement.lang = '';
  });

  it('sets dir="rtl" for Kurdish (ku) on init (Requirement 4.5)', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue('ku'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    vi.resetModules();
    await import('./i18n');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('sets dir="rtl" for Arabic (ar) on init (Requirement 4.5)', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue('ar'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    vi.resetModules();
    await import('./i18n');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('sets dir="ltr" for English (en) on init (Requirement 4.5)', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue('en'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    vi.resetModules();
    await import('./i18n');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('updates dir to "rtl" when switching to Arabic (Requirement 4.5)', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue('en'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    vi.resetModules();
    const mod = await import('./i18n');
    await mod.default.changeLanguage('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('updates dir to "ltr" when switching to English (Requirement 4.5)', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue('ku'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    vi.resetModules();
    const mod = await import('./i18n');
    await mod.default.changeLanguage('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('sets document.documentElement.lang to the language code (Requirement 4.5)', async () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn().mockReturnValue('en'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    });
    vi.resetModules();
    const mod = await import('./i18n');
    await mod.default.changeLanguage('ar');
    expect(document.documentElement.lang).toBe('ar');
  });
});
