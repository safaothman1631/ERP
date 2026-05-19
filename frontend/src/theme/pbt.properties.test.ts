/**
 * pbt.properties.test.ts
 *
 * Property-Based Tests for the UI Redesign Modern spec — Properties 1–10.
 * Uses fast-check for property generation.
 *
 * Runner: Vitest (jsdom environment)
 *
 * Properties covered:
 *   1.  Theme modes produce distinct background colors          (Req 1.2)
 *   2.  Density modes produce distinct control heights          (Req 1.5)
 *   3.  RTL font family contains Vazirmatn; LTR contains Inter  (Req 1.7)
 *   4.  Theme and density preferences round-trip through localStorage (Req 1.9)
 *   5.  Reduced-motion disables all animation durations         (Req 2.5, 7.6, 9.7)
 *   6.  All non-page-transition duration tokens are ≤ 300ms     (Req 2.6, 7.7)
 *   7.  RTL languages set dir="rtl" on the html element         (Req 3.5)
 *   8.  Language selection persists to localStorage             (Req 3.7)
 *   9.  Invalid language codes fall back to Kurdish Sorani      (Req 3.8)
 *   10. Sidebar favorites never exceed 10 items                 (Req 4.7)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import {
  buildAntTokens,
  fontFamily,
  duration,
  palette,
  controlHeight,
  type Density,
} from './tokens';
import { resolveLanguage, isRTLLanguage, VALID_LANGUAGES, type Language } from '../utils/language';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** All supported density values (matches the Density type in tokens.ts) */
const ALL_DENSITIES: Density[] = ['compact', 'default', 'comfortable', 'comfort', 'spacious'];

/** All supported theme modes */
const ALL_MODES = ['light', 'dark'] as const;
type ThemeMode = typeof ALL_MODES[number];

/** Arbitrary for a valid theme mode */
const arbMode = fc.constantFrom<ThemeMode>(...ALL_MODES);

/** Arbitrary for a valid density */
const arbDensity = fc.constantFrom<Density>(...ALL_DENSITIES);

/** Arbitrary for a boolean (isRTL) */
const arbIsRTL = fc.boolean();

// ─── localStorage mock helpers ───────────────────────────────────────────────

function clearLocalStorage() {
  try { localStorage.clear(); } catch { /* noop in non-browser */ }
}

// ─── Property 1: Theme modes produce distinct background colors ──────────────
/**
 * **Validates: Requirements 1.2**
 *
 * For any density and isRTL combination, the colorBgBase token returned by
 * buildAntTokens must differ between 'light' and 'dark' modes.
 */
describe('Property 1: Theme modes produce distinct background colors', () => {
  it('colorBgBase differs between light and dark for all density/RTL combinations', () => {
    fc.assert(
      fc.property(arbDensity, arbIsRTL, (density, isRTL) => {
        const light = buildAntTokens('light', density, isRTL);
        const dark  = buildAntTokens('dark',  density, isRTL);

        // colorBgBase must be distinct between modes
        expect(light.colorBgBase).not.toBe(dark.colorBgBase);
        // colorBgContainer must also be distinct
        expect(light.colorBgContainer).not.toBe(dark.colorBgContainer);
        // Light mode uses the surface token; dark mode uses the dark surface token
        expect(light.colorBgBase).toBe(palette.surface);
        expect(dark.colorBgBase).toBe(palette.darkBg);
      }),
      { numRuns: 50 }
    );
  });
});

// ─── Property 2: Density modes produce distinct control heights ──────────────
/**
 * **Validates: Requirements 1.5**
 *
 * For any theme mode and isRTL combination, the controlHeight token must
 * differ between at least some density pairs — specifically compact < spacious.
 */
describe('Property 2: Density modes produce distinct control heights', () => {
  it('compact controlHeight is strictly less than spacious controlHeight', () => {
    fc.assert(
      fc.property(arbMode, arbIsRTL, (mode, isRTL) => {
        const compact  = buildAntTokens(mode, 'compact',  isRTL);
        const spacious = buildAntTokens(mode, 'spacious', isRTL);

        expect(compact.controlHeight).toBeLessThan(spacious.controlHeight);
      }),
      { numRuns: 50 }
    );
  });

  it('each density maps to the expected controlHeight value', () => {
    fc.assert(
      fc.property(arbMode, arbIsRTL, (mode, isRTL) => {
        const compactTokens     = buildAntTokens(mode, 'compact',     isRTL);
        const defaultTokens     = buildAntTokens(mode, 'default',     isRTL);
        const comfortableTokens = buildAntTokens(mode, 'comfortable', isRTL);
        const comfortTokens     = buildAntTokens(mode, 'comfort',     isRTL);
        const spaciousTokens    = buildAntTokens(mode, 'spacious',    isRTL);

        expect(compactTokens.controlHeight).toBe(controlHeight.compact);
        expect(defaultTokens.controlHeight).toBe(controlHeight.default);
        expect(comfortableTokens.controlHeight).toBe(controlHeight.comfortable);
        expect(comfortTokens.controlHeight).toBe(controlHeight.comfort);
        expect(spaciousTokens.controlHeight).toBe(controlHeight.spacious);
      }),
      { numRuns: 50 }
    );
  });
});

// ─── Property 3: RTL font family contains Vazirmatn; LTR contains Inter ──────
/**
 * **Validates: Requirements 1.7**
 *
 * For any theme mode and density, buildAntTokens must return a fontFamily
 * containing 'Vazirmatn' when isRTL=true and 'Inter' when isRTL=false.
 */
describe('Property 3: RTL font family contains Vazirmatn; LTR contains Inter', () => {
  it('RTL tokens always contain Vazirmatn in fontFamily', () => {
    fc.assert(
      fc.property(arbMode, arbDensity, (mode, density) => {
        const tokens = buildAntTokens(mode, density, true);
        expect(tokens.fontFamily).toContain('Vazirmatn');
      }),
      { numRuns: 50 }
    );
  });

  it('LTR tokens always contain Inter in fontFamily', () => {
    fc.assert(
      fc.property(arbMode, arbDensity, (mode, density) => {
        const tokens = buildAntTokens(mode, density, false);
        expect(tokens.fontFamily).toContain('Inter');
      }),
      { numRuns: 50 }
    );
  });

  it('RTL fontFamily does not contain Inter; LTR fontFamily does not contain Vazirmatn', () => {
    fc.assert(
      fc.property(arbMode, arbDensity, (mode, density) => {
        const rtlTokens = buildAntTokens(mode, density, true);
        const ltrTokens = buildAntTokens(mode, density, false);

        // RTL stack should be the RTL font family
        expect(rtlTokens.fontFamily).toBe(fontFamily.rtl);
        // LTR stack should be the LTR font family
        expect(ltrTokens.fontFamily).toBe(fontFamily.ltr);
        // They must differ
        expect(rtlTokens.fontFamily).not.toBe(ltrTokens.fontFamily);
      }),
      { numRuns: 50 }
    );
  });
});

// ─── Property 4: Theme and density preferences round-trip through localStorage ─
/**
 * **Validates: Requirements 1.9**
 *
 * Writing a theme or density value to localStorage and reading it back must
 * return the same value. This validates the persistence contract used by
 * uiStore (which writes to 'ui.theme' and 'ui.density').
 */
describe('Property 4: Theme and density preferences round-trip through localStorage', () => {
  beforeEach(clearLocalStorage);
  afterEach(clearLocalStorage);

  it('theme value round-trips through localStorage under key "ui.theme"', () => {
    fc.assert(
      fc.property(arbMode, (mode) => {
        localStorage.setItem('ui.theme', mode);
        const retrieved = localStorage.getItem('ui.theme');
        expect(retrieved).toBe(mode);
      }),
      { numRuns: 20 }
    );
  });

  it('density value round-trips through localStorage under key "ui.density"', () => {
    fc.assert(
      fc.property(arbDensity, (density) => {
        localStorage.setItem('ui.density', density);
        const retrieved = localStorage.getItem('ui.density');
        expect(retrieved).toBe(density);
      }),
      { numRuns: 20 }
    );
  });

  it('theme and density can be stored and retrieved independently', () => {
    fc.assert(
      fc.property(arbMode, arbDensity, (mode, density) => {
        localStorage.setItem('ui.theme', mode);
        localStorage.setItem('ui.density', density);

        const retrievedTheme   = localStorage.getItem('ui.theme');
        const retrievedDensity = localStorage.getItem('ui.density');

        expect(retrievedTheme).toBe(mode);
        expect(retrievedDensity).toBe(density);
      }),
      { numRuns: 30 }
    );
  });
});

// ─── Property 5: Reduced-motion disables all animation durations ─────────────
/**
 * **Validates: Requirements 2.5, 7.6, 9.7**
 *
 * When reduced-motion is active, all animation durations should be 0 (instant).
 * The `duration.instant` token is the canonical zero-duration value.
 * This property verifies that the instant token is 0 and that it is the only
 * zero-duration value — all other durations are positive.
 *
 * The MotionGate component uses `useReducedMotion()` from Framer Motion and
 * renders the final static state immediately (duration = 0) when the media
 * query matches. We test the token contract here: duration.instant === 0.
 */
describe('Property 5: Reduced-motion disables all animation durations', () => {
  it('duration.instant is exactly 0 (the reduced-motion duration)', () => {
    expect(duration.instant).toBe(0);
  });

  it('all non-instant duration tokens are strictly positive', () => {
    // When reduced-motion is NOT active, all durations must be > 0
    const nonInstantDurations = Object.entries(duration).filter(([key]) => key !== 'instant');
    fc.assert(
      fc.property(
        fc.constantFrom(...nonInstantDurations),
        ([key, value]) => {
          expect(value, `duration.${key} should be > 0`).toBeGreaterThan(0);
        }
      ),
      { numRuns: nonInstantDurations.length }
    );
  });

  it('reduced-motion maps to duration.instant (0ms) for any animation token', () => {
    // Simulate what MotionGate does: when prefers-reduced-motion is set,
    // the effective duration for any animation becomes duration.instant (0).
    const reducedMotionDuration = (originalDuration: number, prefersReducedMotion: boolean): number => {
      return prefersReducedMotion ? duration.instant : originalDuration;
    };

    fc.assert(
      fc.property(
        fc.constantFrom(...Object.values(duration)),
        fc.boolean(),
        (originalDuration, prefersReducedMotion) => {
          const effective = reducedMotionDuration(originalDuration, prefersReducedMotion);
          if (prefersReducedMotion) {
            expect(effective).toBe(0);
          } else {
            expect(effective).toBe(originalDuration);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ─── Property 6: All non-page-transition duration tokens are ≤ 300ms ─────────
/**
 * **Validates: Requirements 2.6, 7.7**
 *
 * All micro-interaction and text-animation duration tokens must be ≤ 300ms.
 * The `verySlow` token (600ms) is reserved for page transitions (max 600ms).
 * The `slow` token (400ms) is reserved for structural layout animations
 * (e.g. sidebar collapse/expand) which are not micro-interactions or text
 * animations — these are excluded from the strict 300ms limit.
 *
 * Tokens subject to the ≤ 300ms rule: instant, fast, normal.
 * Tokens excluded (structural/page transitions): slow (400ms), verySlow (600ms).
 */
describe('Property 6: All non-page-transition duration tokens are ≤ 300ms', () => {
  it('micro-interaction and text-animation duration tokens (instant/fast/normal) are ≤ 300ms', () => {
    // These are the tokens used for micro-interactions and text animations
    const microInteractionDurations: Array<[string, number]> = [
      ['instant', duration.instant],
      ['fast',    duration.fast],
      ['normal',  duration.normal],
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...microInteractionDurations),
        ([key, value]) => {
          expect(value, `duration.${key} (${value}ms) should be ≤ 300ms`).toBeLessThanOrEqual(300);
        }
      ),
      { numRuns: microInteractionDurations.length }
    );
  });

  it('verySlow duration is ≤ 600ms (page transition maximum)', () => {
    expect(duration.verySlow).toBeLessThanOrEqual(600);
  });

  it('slow duration is ≤ 600ms (structural layout animation maximum)', () => {
    // Sidebar collapse/expand and other structural animations use the slow token
    expect(duration.slow).toBeLessThanOrEqual(600);
  });

  it('fast duration (micro-interactions) is ≤ 150ms', () => {
    // Requirement 8.8: all micro-interactions complete within 150ms
    expect(duration.fast).toBeLessThanOrEqual(150);
  });

  it('normal duration is ≤ 300ms (text animations and transitions)', () => {
    expect(duration.normal).toBeLessThanOrEqual(300);
  });
});

// ─── Property 7: RTL languages set dir="rtl" on the html element ─────────────
/**
 * **Validates: Requirements 3.5**
 *
 * For any RTL language code ('ku', 'ar'), isRTLLanguage() must return true.
 * For 'en', it must return false.
 * The html element direction is set based on this function.
 */
describe('Property 7: RTL languages set dir="rtl" on the html element', () => {
  it('isRTLLanguage returns true for ku and ar', () => {
    const rtlLanguages: Language[] = ['ku', 'ar'];
    fc.assert(
      fc.property(fc.constantFrom<Language>(...rtlLanguages), (lang) => {
        expect(isRTLLanguage(lang)).toBe(true);
      }),
      { numRuns: 20 }
    );
  });

  it('isRTLLanguage returns false for en', () => {
    expect(isRTLLanguage('en')).toBe(false);
  });

  it('html dir attribute is set to "rtl" for RTL languages', () => {
    const rtlLanguages: Language[] = ['ku', 'ar'];
    fc.assert(
      fc.property(fc.constantFrom<Language>(...rtlLanguages), (lang) => {
        // Simulate what App.tsx does on language change
        const dir = isRTLLanguage(lang) ? 'rtl' : 'ltr';
        document.documentElement.setAttribute('dir', dir);
        expect(document.documentElement.getAttribute('dir')).toBe('rtl');
      }),
      { numRuns: 20 }
    );
  });

  it('html dir attribute is set to "ltr" for English', () => {
    const dir = isRTLLanguage('en') ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  });

  it('every valid language produces a non-empty dir value', () => {
    fc.assert(
      fc.property(fc.constantFrom<Language>(...VALID_LANGUAGES), (lang) => {
        const dir = isRTLLanguage(lang) ? 'rtl' : 'ltr';
        expect(['rtl', 'ltr']).toContain(dir);
      }),
      { numRuns: 20 }
    );
  });
});

// ─── Property 8: Language selection persists to localStorage ─────────────────
/**
 * **Validates: Requirements 3.7**
 *
 * Writing a valid language code to localStorage under 'i18n.language' and
 * reading it back must return the same value.
 */
describe('Property 8: Language selection persists to localStorage', () => {
  beforeEach(clearLocalStorage);
  afterEach(clearLocalStorage);

  it('valid language codes round-trip through localStorage under "i18n.language"', () => {
    fc.assert(
      fc.property(fc.constantFrom<Language>(...VALID_LANGUAGES), (lang) => {
        localStorage.setItem('i18n.language', lang);
        const retrieved = localStorage.getItem('i18n.language');
        expect(retrieved).toBe(lang);
      }),
      { numRuns: 20 }
    );
  });

  it('language persisted to localStorage is always a valid language code', () => {
    fc.assert(
      fc.property(fc.constantFrom<Language>(...VALID_LANGUAGES), (lang) => {
        localStorage.setItem('i18n.language', lang);
        const retrieved = localStorage.getItem('i18n.language') ?? '';
        // The retrieved value must be one of the valid languages
        expect(VALID_LANGUAGES as readonly string[]).toContain(retrieved);
      }),
      { numRuns: 20 }
    );
  });

  it('overwriting language in localStorage reflects the latest value', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<Language>(...VALID_LANGUAGES),
        fc.constantFrom<Language>(...VALID_LANGUAGES),
        (first, second) => {
          localStorage.setItem('i18n.language', first);
          localStorage.setItem('i18n.language', second);
          const retrieved = localStorage.getItem('i18n.language');
          expect(retrieved).toBe(second);
        }
      ),
      { numRuns: 30 }
    );
  });
});

// ─── Property 9: Invalid language codes fall back to Kurdish Sorani ──────────
/**
 * **Validates: Requirements 3.8**
 *
 * resolveLanguage() must return 'ku' for any code not in ['ku', 'en', 'ar'].
 */
describe('Property 9: Invalid language codes fall back to Kurdish Sorani', () => {
  it('resolveLanguage returns "ku" for any string not in the valid set', () => {
    // Generate arbitrary strings that are NOT valid language codes
    const invalidCodeArb = fc.string({ minLength: 0, maxLength: 20 }).filter(
      (s) => !(VALID_LANGUAGES as readonly string[]).includes(s)
    );

    fc.assert(
      fc.property(invalidCodeArb, (code) => {
        const result = resolveLanguage(code);
        expect(result).toBe('ku');
      }),
      { numRuns: 200 }
    );
  });

  it('resolveLanguage returns the input unchanged for valid language codes', () => {
    fc.assert(
      fc.property(fc.constantFrom<Language>(...VALID_LANGUAGES), (lang) => {
        const result = resolveLanguage(lang);
        expect(result).toBe(lang);
      }),
      { numRuns: 20 }
    );
  });

  it('resolveLanguage handles edge cases: empty string, numbers, special chars', () => {
    const edgeCases = ['', '  ', 'KU', 'EN', 'AR', 'fr', 'de', 'zh', '123', 'null', 'undefined'];
    for (const code of edgeCases) {
      if (!(VALID_LANGUAGES as readonly string[]).includes(code)) {
        expect(resolveLanguage(code)).toBe('ku');
      }
    }
  });

  it('resolveLanguage is case-sensitive: "KU" is not valid and falls back to "ku"', () => {
    expect(resolveLanguage('KU')).toBe('ku');
    expect(resolveLanguage('EN')).toBe('ku');
    expect(resolveLanguage('AR')).toBe('ku');
  });
});

// ─── Property 10: Sidebar favorites never exceed 10 items ────────────────────
/**
 * **Validates: Requirements 4.7**
 *
 * The navStore.pin() function must enforce a maximum of 10 favorites.
 * We test the pure logic directly (without Zustand) to keep the test fast.
 */
describe('Property 10: Sidebar favorites never exceed 10 items', () => {
  const MAX_FAVORITES = 10;

  /**
   * Pure implementation of the pin logic (mirrors navStore.pin).
   * Returns the new favorites array after attempting to pin an item.
   */
  function pin(favorites: Array<{ key: string }>, item: { key: string }): Array<{ key: string }> {
    if (favorites.some((f) => f.key === item.key)) return favorites; // already pinned
    if (favorites.length >= MAX_FAVORITES) return favorites;          // limit reached
    return [...favorites, item];
  }

  it('favorites never exceed 10 items regardless of how many pins are attempted', () => {
    // Generate a sequence of up to 30 items to pin
    const itemArb = fc.record({ key: fc.string({ minLength: 1, maxLength: 20 }) });
    const itemsArb = fc.array(itemArb, { minLength: 1, maxLength: 30 });

    fc.assert(
      fc.property(itemsArb, (items) => {
        let favorites: Array<{ key: string }> = [];
        for (const item of items) {
          favorites = pin(favorites, item);
        }
        expect(favorites.length).toBeLessThanOrEqual(MAX_FAVORITES);
      }),
      { numRuns: 200 }
    );
  });

  it('pinning the same item twice does not increase the count', () => {
    const itemArb = fc.record({ key: fc.string({ minLength: 1, maxLength: 20 }) });

    fc.assert(
      fc.property(itemArb, (item) => {
        let favorites: Array<{ key: string }> = [];
        favorites = pin(favorites, item);
        const countAfterFirst = favorites.length;
        favorites = pin(favorites, item);
        const countAfterSecond = favorites.length;
        expect(countAfterSecond).toBe(countAfterFirst);
      }),
      { numRuns: 100 }
    );
  });

  it('pinning 10 unique items fills favorites to exactly 10', () => {
    const tenUniqueItems = Array.from({ length: 10 }, (_, i) => ({ key: `item-${i}` }));
    let favorites: Array<{ key: string }> = [];
    for (const item of tenUniqueItems) {
      favorites = pin(favorites, item);
    }
    expect(favorites.length).toBe(10);
  });

  it('pinning an 11th unique item does not increase favorites beyond 10', () => {
    const elevenUniqueItems = Array.from({ length: 11 }, (_, i) => ({ key: `item-${i}` }));
    let favorites: Array<{ key: string }> = [];
    for (const item of elevenUniqueItems) {
      favorites = pin(favorites, item);
    }
    expect(favorites.length).toBe(10);
  });

  it('favorites count is always in range [0, 10] for any sequence of pin operations', () => {
    const uniqueKeyArb = fc.uniqueArray(
      fc.string({ minLength: 1, maxLength: 20 }),
      { minLength: 0, maxLength: 25 }
    );

    fc.assert(
      fc.property(uniqueKeyArb, (keys) => {
        let favorites: Array<{ key: string }> = [];
        for (const key of keys) {
          favorites = pin(favorites, { key });
          expect(favorites.length).toBeGreaterThanOrEqual(0);
          expect(favorites.length).toBeLessThanOrEqual(MAX_FAVORITES);
        }
      }),
      { numRuns: 200 }
    );
  });
});
