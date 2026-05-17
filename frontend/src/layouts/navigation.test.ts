// Feature: nav-settings-cleanup, Property 1: No duplicate route paths in flattened navigation
// Feature: nav-settings-cleanup, Property 2: Deduplication preserves all unique routes

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { buildNavSections, flattenRoutes } from './navigation';
import type { NavSection, NavLeaf } from './navigation';

/**
 * Minimal mock for TFunction — returns the fallback if provided, otherwise the key.
 * This mirrors how i18next behaves when a key is missing.
 */
const mockT = (key: string, fallback?: string | Record<string, unknown>): string => {
  if (typeof fallback === 'string') return fallback;
  return key;
};

// ---------------------------------------------------------------------------
// Arbitraries for Property 2
// ---------------------------------------------------------------------------

/**
 * Generates a valid route-like key string (e.g. "/foo", "/foo/bar").
 * Constrained to ASCII path segments to keep generated data readable.
 */
const arbitraryRouteKey = (): fc.Arbitrary<string> =>
  fc.array(
    fc.stringMatching(/^[a-z][a-z0-9-]{0,10}$/),
    { minLength: 1, maxLength: 4 }
  ).map(segments => '/' + segments.join('/'));

/**
 * Generates a NavLeaf with a unique-ish key.
 */
const arbitraryNavLeaf = (): fc.Arbitrary<NavLeaf> =>
  fc.record({
    key: arbitraryRouteKey(),
    label: fc.string({ minLength: 1, maxLength: 30 }),
  });

/**
 * Generates a NavSection with 1–10 items.
 * The zone and icon are fixed to minimal valid values.
 */
const arbitraryNavSection = (): fc.Arbitrary<NavSection> =>
  fc.record({
    key: fc.stringMatching(/^[a-z][a-z0-9-]{0,15}$/),
    label: fc.string({ minLength: 1, maxLength: 30 }),
    icon: fc.constant(null as unknown as React.ReactNode),
    zone: fc.constantFrom(
      'core-commerce' as const,
      'operations' as const,
      'people' as const,
      'finance-control' as const,
    ),
    items: fc.array(arbitraryNavLeaf(), { minLength: 1, maxLength: 10 }),
  });

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('flattenRoutes', () => {
  /**
   * Property 1: No duplicate route paths in flattened navigation
   * Validates: Requirements 1.1, 1.10
   */
  it('flattenRoutes returns no duplicate keys', () => {
    const sections = buildNavSections(mockT as any);
    const leaves = flattenRoutes(sections);
    const keys = leaves.map(l => l.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  /**
   * Property 2: Deduplication preserves all unique routes
   * Validates: Requirements 1.9
   *
   * For any set of NavSections, the set of unique route paths that exist in the
   * sections SHALL all be present in the flattened result — no route is silently
   * dropped by flattenRoutes().
   *
   * Since deduplicateSections() is not exported, we test the observable
   * behaviour: buildNavSections(mockT) followed by flattenRoutes() must
   * preserve every unique route that was declared in the sections array.
   * We also verify this property holds for arbitrary generated sections.
   */
  it('flattenRoutes preserves all unique routes — Property 2 (arbitrary sections)', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryNavSection(), { minLength: 1, maxLength: 20 }),
        (sections) => {
          // Collect the set of unique keys that exist BEFORE flattening
          const uniqueKeysBefore = new Set(
            sections.flatMap(s => s.items.map(i => i.key))
          );

          // Flatten the sections
          const leaves = flattenRoutes(sections);
          const uniqueKeysAfter = new Set(leaves.map(l => l.key));

          // Every unique key that existed before must still be present after
          for (const k of uniqueKeysBefore) {
            if (!uniqueKeysAfter.has(k)) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('flattenRoutes preserves all unique routes — Property 2 (real buildNavSections)', () => {
    // Verify the same property holds for the actual production nav sections
    const sections = buildNavSections(mockT as any);

    const uniqueKeysBefore = new Set(
      sections.flatMap(s => s.items.map(i => i.key))
    );

    const leaves = flattenRoutes(sections);
    const uniqueKeysAfter = new Set(leaves.map(l => l.key));

    for (const k of uniqueKeysBefore) {
      expect(uniqueKeysAfter.has(k)).toBe(true);
    }
  });
});

/**
 * Unit tests for mixed-language keyword fix
 * Validates: Requirements 8.5, 8.6, 8.7
 */
describe('mixed-language keyword fix', () => {
  const sections = buildNavSections(mockT as any);

  /**
   * Requirement 8.6, 8.7: No Kurdish characters in the shared keywords[] array.
   * Kurdish text must live in keywordsKu[], not keywords[].
   */
  it('no keywords[] array in any NavLeaf contains Kurdish Unicode characters', () => {
    const kurdishRange = /[\u0600-\u06FF]/;
    sections.forEach(section => {
      section.items.forEach(item => {
        (item.keywords || []).forEach(kw => {
          expect(
            kurdishRange.test(kw),
            `Kurdish character found in keywords[] of item "${item.key}": "${kw}"`
          ).toBe(false);
        });
      });
    });
  });

  /**
   * Requirement 8.5: The users item in setup must have an English fallback string.
   * t('users', 'Users') — fallback must be 'Users', not Kurdish 'بەکارهێنەران'.
   */
  it('users item in setup section has English fallback "Users"', () => {
    const setupSection = sections.find(s => s.key === 'setup');
    expect(setupSection, 'setup section not found').toBeDefined();

    const usersItem = setupSection!.items.find(item => item.key === '/users');
    expect(usersItem, '/users item not found in setup section').toBeDefined();

    // mockT returns the fallback string when provided, so label === fallback
    expect(usersItem!.label).toBe('Users');
    // Ensure it is not the Kurdish word
    expect(usersItem!.label).not.toBe('بەکارهێنەران');
  });
});

describe('Kurdish UI translation', () => {
  /**
   * Feature: nav-settings-cleanup, Property 3: No English fallback rendered in Kurdish UI
   * Validates: Requirements 3.1, 3.2, 8.1
   */
  it('all nav labels resolve to Kurdish when language is ku', () => {
    // Build a kuT mock that resolves from ku.json
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const kuTranslations = require('../locales/ku.json');

    /**
     * Resolve a dot-notation key against a nested object.
     * e.g. 'maintenance.requests' -> kuTranslations.maintenance.requests
     */
    const resolveKey = (obj: Record<string, unknown>, key: string): string | undefined => {
      // First try flat lookup (most keys are top-level)
      if (typeof obj[key] === 'string') return obj[key] as string;
      // Then try dot-notation traversal for nested keys
      const parts = key.split('.');
      let current: unknown = obj;
      for (const part of parts) {
        if (current == null || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part];
      }
      return typeof current === 'string' ? current : undefined;
    };

    const kuT = (key: string, fallback?: string) => resolveKey(kuTranslations, key) ?? fallback ?? key;

    const sections = buildNavSections(kuT as any);
    const allLabels = [
      ...sections.map(s => s.label),
      ...sections.flatMap(s => s.items.map(i => i.label)),
    ];

    // Get the English fallback strings from en.json
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const enTranslations = require('../locales/en.json');

    /**
     * Collect all string values from a (possibly nested) translations object.
     */
    const collectStringValues = (obj: unknown): Set<string> => {
      const values = new Set<string>();
      const traverse = (node: unknown) => {
        if (typeof node === 'string') { values.add(node); return; }
        if (node && typeof node === 'object') {
          for (const v of Object.values(node as Record<string, unknown>)) traverse(v);
        }
      };
      traverse(obj);
      return values;
    };

    const enValues = collectStringValues(enTranslations);
    const kuValues = collectStringValues(kuTranslations);

    // Assert no label equals an English fallback string
    allLabels.forEach(label => {
      // The label should not be a raw English fallback string
      // (it should either be a Kurdish translation or a key)
      const isEnglishFallback = enValues.has(label) && !kuValues.has(label);
      expect(isEnglishFallback).toBe(false);
    });
  });
});

// ─── Task 11.6: Unit tests for navigation deduplication ───────────────────────
// Validates: Requirements 1.2–1.8, 4.2–4.6

describe('buildNavSections — deduplication: no standalone duplicate sections (Req 1.2–1.4)', () => {
  const sections = buildNavSections(mockT as any);
  const sectionKeys = sections.map(s => s.key);

  // Req 1.2: standalone `quality` section must not exist
  it('does not contain a standalone "quality" section (Req 1.2)', () => {
    expect(sectionKeys).not.toContain('quality');
  });

  // Req 1.3: standalone `ai-assist` section must not exist
  it('does not contain a standalone "ai-assist" section (Req 1.3)', () => {
    expect(sectionKeys).not.toContain('ai-assist');
  });

  // Req 1.4: standalone `admin-config` section must not exist
  it('does not contain a standalone "admin-config" section (Req 1.4)', () => {
    expect(sectionKeys).not.toContain('admin-config');
  });
});

describe('buildNavSections — setup contains all items previously in admin-config (Req 1.4, 4.6)', () => {
  const sections = buildNavSections(mockT as any);
  const setupSection = sections.find(s => s.key === 'setup');
  const setupRoutes = setupSection?.items.map(i => i.key) ?? [];

  it('setup section exists', () => {
    expect(setupSection).toBeDefined();
  });

  it('setup contains /settings/numbering (previously in admin-config)', () => {
    expect(setupRoutes).toContain('/settings/numbering');
  });

  it('setup contains /automation-rules (previously in admin-config)', () => {
    expect(setupRoutes).toContain('/automation-rules');
  });

  it('setup contains /audit-log-viewer (previously in admin-config)', () => {
    expect(setupRoutes).toContain('/audit-log-viewer');
  });

  it('setup contains /admin/job-runs (previously in admin-config)', () => {
    expect(setupRoutes).toContain('/admin/job-runs');
  });

  it('setup contains /studio (previously in admin-config)', () => {
    expect(setupRoutes).toContain('/studio');
  });
});

describe('buildNavSections — ext-engagement contains no field-service items (Req 1.6, 4.2)', () => {
  const sections = buildNavSections(mockT as any);
  const extEngagement = sections.find(s => s.key === 'ext-engagement');
  const engagementRoutes = extEngagement?.items.map(i => i.key) ?? [];

  it('ext-engagement section exists', () => {
    expect(extEngagement).toBeDefined();
  });

  it('ext-engagement does not contain /wave-a/field-service (Req 1.6)', () => {
    expect(engagementRoutes).not.toContain('/wave-a/field-service');
  });
});

describe('buildNavSections — ext-vertical contains no hotel or restaurant duplicates (Req 1.7, 1.8, 4.5)', () => {
  const sections = buildNavSections(mockT as any);
  const extVertical = sections.find(s => s.key === 'ext-vertical');
  const verticalRoutes = extVertical?.items.map(i => i.key) ?? [];

  it('ext-vertical section exists', () => {
    expect(extVertical).toBeDefined();
  });

  it('ext-vertical does not contain /ext/hotel (Req 1.7)', () => {
    expect(verticalRoutes).not.toContain('/ext/hotel');
  });

  it('ext-vertical does not contain /ext/restaurant (Req 1.8)', () => {
    expect(verticalRoutes).not.toContain('/ext/restaurant');
  });
});
