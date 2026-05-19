/**
 * Shared `fast-check` arbitraries for Help Registry property tests.
 *
 * Used by `frontend/src/system-wide-ux-overhaul.pbt.test.ts` (Property 3
 * — Help registry coverage).
 *
 * The generators here describe the input space for the Help_Registry
 * invariants documented in
 * `.kiro/specs/system-wide-ux-overhaul/design.md` →
 * "Help System" and "Correctness Properties":
 *
 * - {@link sectionIdArb} — arbitrary `SectionId` from the registry.
 * - {@link settingsSectionIdArb} — arbitrary Settings `SectionId`.
 * - {@link helpEntryArb} — arbitrary `HelpEntry` from the registry.
 * - {@link settingsHelpEntryArb} — arbitrary Settings `HelpEntry`.
 */

import * as fc from 'fast-check';

import { SECTION_IDS, type SectionId } from '../sectionIds';
import { helpRegistry, type HelpEntry } from '../registry';

// ─────────────────────────────────────────────────────────────────────────────
// Derived data
// ─────────────────────────────────────────────────────────────────────────────

/** All section IDs as a mutable array for fast-check consumption. */
export const allSectionIds: SectionId[] = [...SECTION_IDS];

/** Settings-only section IDs (those starting with `settings.`). */
export const settingsSectionIds: SectionId[] = allSectionIds.filter(
  (id) => id.startsWith('settings.'),
);

/** Non-settings section IDs. */
export const nonSettingsSectionIds: SectionId[] = allSectionIds.filter(
  (id) => !id.startsWith('settings.'),
);

// ─────────────────────────────────────────────────────────────────────────────
// Arbitraries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Arbitrary `SectionId` drawn uniformly from the full `SECTION_IDS` list.
 */
export const sectionIdArb: fc.Arbitrary<SectionId> = fc.constantFrom(
  ...allSectionIds,
);

/**
 * Arbitrary Settings `SectionId` (those starting with `settings.`).
 */
export const settingsSectionIdArb: fc.Arbitrary<SectionId> = fc.constantFrom(
  ...settingsSectionIds,
);

/**
 * Arbitrary non-settings `SectionId`.
 */
export const nonSettingsSectionIdArb: fc.Arbitrary<SectionId> = fc.constantFrom(
  ...nonSettingsSectionIds,
);

/**
 * Arbitrary `HelpEntry` drawn from the registry, paired with its `SectionId`.
 */
export const helpEntryArb: fc.Arbitrary<{ id: SectionId; entry: HelpEntry }> =
  sectionIdArb.map((id) => ({ id, entry: helpRegistry[id] }));

/**
 * Arbitrary Settings `HelpEntry` drawn from the registry.
 */
export const settingsHelpEntryArb: fc.Arbitrary<{ id: SectionId; entry: HelpEntry }> =
  settingsSectionIdArb.map((id) => ({ id, entry: helpRegistry[id] }));

/**
 * The full help registry as a constant for exhaustive iteration tests.
 */
export { helpRegistry, SECTION_IDS };

// ─────────────────────────────────────────────────────────────────────────────
// Fallback independence generators (Property 10)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The three independent fallback paths defined in the design:
 * - `ui`  — render value from the other locale (UI fallback)
 * - `log` — emit console.warn (dev) / structured warn (prod)
 * - `ci`  — i18n-coverage CI job detects the gap
 */
export type FallbackPath = 'ui' | 'log' | 'ci';

/** All three fallback paths. */
export const ALL_FALLBACK_PATHS: FallbackPath[] = ['ui', 'log', 'ci'];

/** Alias for backward compatibility with existing test code. */
export const ALL_PATHS = ALL_FALLBACK_PATHS;

/**
 * All proper subsets of `{ui, log, ci}` — i.e. every subset except the
 * full set. These represent the "failed paths" in each test scenario.
 * The complement represents the paths that must still execute.
 *
 * Proper subsets (7 total, excluding the full set of 3):
 *   [], [ui], [log], [ci], [ui,log], [ui,ci], [log,ci]
 */
export const PROPER_SUBSETS: FallbackPath[][] = [
  [],
  ['ui'],
  ['log'],
  ['ci'],
  ['ui', 'log'],
  ['ui', 'ci'],
  ['log', 'ci'],
];

/** The type of failure event that triggered the fallback paths. */
export type FallbackFailureEvent = 'missing-translation' | 'registry-load-failure';

/**
 * A scenario for testing fallback independence.
 *
 * - `failedPaths` — the subset of paths that are simulated as failed.
 * - `remainingPaths` — the complement: paths that should still execute.
 * - `sectionId` — the section whose help is being resolved.
 * - `failureEvent` — what triggered the fallback (missing key or registry load failure).
 * - `locale` — the active locale when the failure occurs.
 */
export interface FallbackIndependenceScenario {
  /** Proper subset of {ui, log, ci} that are "broken" in this scenario. */
  failedPaths: FallbackPath[];
  /** The complement: paths NOT in failedPaths that must still execute. */
  remainingPaths: FallbackPath[];
  /** The section being resolved. */
  sectionId: SectionId;
  /** What triggered the fallback paths. */
  failureEvent: FallbackFailureEvent;
  /** The active locale when the failure occurs. */
  locale: 'en' | 'ku';
}

/**
 * Arbitrary for fallback independence scenarios.
 *
 * Generates a proper subset of `{ui, log, ci}` paired with a random
 * `sectionId`, a failure event type, and an active locale.
 * Automatically computes `remainingPaths` as the complement.
 */
export const fallbackIndependenceArb: fc.Arbitrary<FallbackIndependenceScenario> =
  fc.record({
    failedPaths: fc.constantFrom(...PROPER_SUBSETS),
    sectionId: sectionIdArb,
    failureEvent: fc.constantFrom<FallbackFailureEvent>('missing-translation', 'registry-load-failure'),
    locale: fc.constantFrom<'en' | 'ku'>('en', 'ku'),
  }).map((raw) => ({
    ...raw,
    remainingPaths: ALL_FALLBACK_PATHS.filter((p) => !raw.failedPaths.includes(p)),
  }));
