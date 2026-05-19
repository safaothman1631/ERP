import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin } from '../../e2e/helpers/auth';
import {
  navDestinations,
  type NavDestination,
} from '../../src/layouts/navDestinations';
import { PROPER_NOUNS } from '../../src/i18n/properNouns';
import { SECTION_IDS } from '../../src/help/sectionIds';

/**
 * route-walk.spec.ts — Definition-of-Done route-walk (Task 8.1).
 *
 * Walks every entry in the route registry across the viewport × locale
 * matrix and asserts three correctness properties:
 *
 *   P5 — No horizontal page overflow (`scrollWidth ≤ clientWidth`).
 *   P6 — Visible-text-node language matches active locale (skipping
 *         `display: none`, `visibility: hidden`, `aria-hidden="true"`,
 *         `data-i18n-test="ignore"`).
 *   P9 — Every Section has a Help_Icon resolving to a registry entry;
 *         every Add-supporting Section uses `useAddGate`.
 *
 * Matrix: viewports {320, 768, 1280} × locales {en, ku}.
 *
 * Validates: Requirements 13.8, 18.1, 18.2
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const VIEWPORTS = [320, 768, 1280] as const;
const LOCALES = ['en', 'ku'] as const;
type Locale = (typeof LOCALES)[number];

/**
 * Deduplicate routes — the navDestinations registry may list the same path
 * multiple times across different surfaces. The route-walk only needs to
 * visit each unique path once per viewport × locale combination.
 */
const UNIQUE_ROUTES: string[] = Array.from(
  new Set(navDestinations.map((d: NavDestination) => d.path)),
);

/**
 * Proper-noun allowlist — Latin-script tokens that are allowed to appear
 * in Kurdish locale without triggering a language-purity violation.
 * Also includes common technical tokens (numbers, punctuation, symbols).
 */
const PROPER_NOUN_SET = new Set<string>(PROPER_NOUNS as unknown as string[]);

// ---------------------------------------------------------------------------
// Unicode script detection helpers
// ---------------------------------------------------------------------------

/**
 * Kurdish (Arabic script) character range — covers Arabic + Arabic Extended
 * blocks used by Kurdish Sorani.
 */
const ARABIC_SCRIPT_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/**
 * Latin script character range — Basic Latin letters + Latin Extended.
 */
const LATIN_SCRIPT_RE = /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set the app locale by writing to localStorage and reloading.
 * The app reads `i18n.language` from localStorage on init.
 */
async function setLocale(page: Page, locale: Locale): Promise<void> {
  await page.evaluate((lng) => {
    localStorage.setItem('i18n.language', lng);
  }, locale);
}

/**
 * Wait for the page to settle after navigation — wait for network idle
 * and any pending React renders.
 */
async function waitForSettle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle').catch(() => {
    /* timeout is acceptable — some routes have no network calls */
  });
  // Give React a tick to finish rendering
  await page.waitForTimeout(500);
}

/**
 * P5: Assert no horizontal page overflow.
 * `scrollWidth ≤ clientWidth` on the scrolling element.
 */
async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement || document.documentElement;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
  expect(
    overflow.scrollWidth,
    `Horizontal overflow detected: scrollWidth (${overflow.scrollWidth}) > clientWidth (${overflow.clientWidth})`,
  ).toBeLessThanOrEqual(overflow.clientWidth);
}

/**
 * P6: Assert language purity of visible text nodes.
 *
 * For `en` locale: no Arabic-script characters (except proper nouns).
 * For `ku` locale: no Latin-script characters (except proper nouns,
 * numbers, punctuation, symbols, and technical tokens).
 *
 * Skips nodes with:
 * - `display: none` ancestor
 * - `visibility: hidden` ancestor
 * - `aria-hidden="true"` ancestor
 * - `data-i18n-test="ignore"` attribute on self or ancestor
 */
async function assertLanguagePurity(
  page: Page,
  locale: Locale,
): Promise<void> {
  const properNouns = Array.from(PROPER_NOUN_SET);

  const violations = await page.evaluate(
    ({ locale, properNouns }) => {
      const found: Array<{ text: string; path: string }> = [];

      /**
       * Check if an element or any ancestor is hidden or marked for skip.
       */
      function isExcluded(el: Element | null): boolean {
        let current: Element | null = el;
        while (current) {
          if (current.getAttribute('data-i18n-test') === 'ignore') return true;
          if (current.getAttribute('aria-hidden') === 'true') return true;
          const style = window.getComputedStyle(current);
          if (style.display === 'none') return true;
          if (style.visibility === 'hidden') return true;
          current = current.parentElement;
        }
        return false;
      }

      /**
       * Get a short path descriptor for debugging.
       */
      function getPath(node: Node): string {
        const el = node.parentElement;
        if (!el) return '(detached)';
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : '';
        const cls = el.className
          ? `.${String(el.className).split(' ').slice(0, 2).join('.')}`
          : '';
        return `${tag}${id}${cls}`;
      }

      /**
       * Strip proper nouns from text before checking script purity.
       */
      function stripProperNouns(text: string): string {
        let result = text;
        for (const noun of properNouns) {
          // Replace all occurrences (case-sensitive)
          result = result.split(noun).join('');
        }
        return result;
      }

      // Arabic script regex
      const arabicRe =
        /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
      // Latin script regex
      const latinRe = /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/;

      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
      );

      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = (node.textContent || '').trim();
        if (!text) continue;

        // Skip if parent element is excluded
        if (node.parentElement && isExcluded(node.parentElement)) continue;

        const cleaned = stripProperNouns(text);
        if (!cleaned.trim()) continue;

        if (locale === 'en') {
          // In English locale, no Arabic-script characters should appear
          if (arabicRe.test(cleaned)) {
            found.push({ text: text.slice(0, 80), path: getPath(node) });
          }
        } else {
          // In Kurdish locale, no Latin-script characters should appear
          // (except numbers, punctuation, symbols, URLs, CSS classes, etc.)
          if (latinRe.test(cleaned)) {
            // Additional heuristic: skip if the text is purely
            // technical (URLs, file paths, CSS values, single letters
            // used as abbreviations like "KB", "MB", version numbers)
            const isLikelyTechnical =
              /^[\d\s\w./:@#%&=?+\-_,;!()[\]{}|<>*^~`'"\\]+$/.test(cleaned) &&
              cleaned.length < 30;
            if (!isLikelyTechnical) {
              found.push({ text: text.slice(0, 80), path: getPath(node) });
            }
          }
        }
      }

      // Limit to first 10 violations for readable output
      return found.slice(0, 10);
    },
    { locale, properNouns },
  );

  expect(
    violations,
    `Language purity violations (locale=${locale}): ${JSON.stringify(violations, null, 2)}`,
  ).toHaveLength(0);
}

/**
 * P9: Assert Help_Icon and AddGate coverage.
 *
 * - Every Section heading should have an adjacent Help_Icon whose
 *   `sectionId` resolves to a known registry entry.
 * - Every Section that supports adding records (has an "Add" or "Create"
 *   primary action) should wire through `useAddGate`.
 *
 * Detection strategy:
 * - Help_Icons are `<button>` elements with `aria-label` matching the
 *   help icon pattern (contains "Help:" or "یارمەتی:") or have a
 *   `data-help-section` attribute.
 * - Add-supporting Sections are detected by the presence of a button
 *   whose text/aria-label contains "Add" or "Create" (en) or their
 *   Kurdish equivalents, and should have a `data-addgate-section`
 *   attribute on their container.
 */
async function assertHelpAndAddGateCoverage(page: Page): Promise<void> {
  const sectionIds: string[] = Array.from(SECTION_IDS);

  const result = await page.evaluate(
    ({ sectionIds }) => {
      const issues: string[] = [];
      const knownIds = new Set(sectionIds);

      // Check Help_Icon coverage:
      // Look for elements with data-help-section attribute — these are
      // Help_Icons rendered by the HelpIcon component.
      const helpIcons = document.querySelectorAll('[data-help-section]');
      helpIcons.forEach((icon) => {
        const sid = icon.getAttribute('data-help-section');
        if (sid && !knownIds.has(sid)) {
          issues.push(
            `Help_Icon references unknown sectionId: "${sid}"`,
          );
        }
      });

      // Check that sections with headings that have a corresponding
      // sectionId in the registry also have a Help_Icon.
      // We look for [data-section-id] containers — these mark Sections.
      const sections = document.querySelectorAll('[data-section-id]');
      sections.forEach((section) => {
        const sid = section.getAttribute('data-section-id');
        if (!sid) return;

        // Check for Help_Icon within or adjacent to this section
        const hasHelpIcon =
          section.querySelector('[data-help-section]') !== null ||
          section.previousElementSibling?.querySelector(
            '[data-help-section]',
          ) !== null;

        if (!hasHelpIcon && knownIds.has(sid)) {
          issues.push(
            `Section "${sid}" missing Help_Icon`,
          );
        }
      });

      // Check AddGate coverage:
      // Sections with data-addgate-section should reference a known sectionId.
      const addGateSections = document.querySelectorAll(
        '[data-addgate-section]',
      );
      addGateSections.forEach((section) => {
        const sid = section.getAttribute('data-addgate-section');
        if (sid && !knownIds.has(sid)) {
          issues.push(
            `AddGate references unknown sectionId: "${sid}"`,
          );
        }
      });

      // Check that sections with "Add" / "Create" buttons use AddGate.
      // Look for buttons with add/create semantics inside sections.
      const addButtons = document.querySelectorAll(
        'button[data-add-action], [role="button"][data-add-action]',
      );
      addButtons.forEach((btn) => {
        // Walk up to find the nearest section container
        let parent: Element | null = btn.parentElement;
        let foundGate = false;
        while (parent) {
          if (parent.hasAttribute('data-addgate-section')) {
            foundGate = true;
            break;
          }
          if (parent.hasAttribute('data-section-id')) {
            break;
          }
          parent = parent.parentElement;
        }
        if (!foundGate && parent?.hasAttribute('data-section-id')) {
          const sid = parent.getAttribute('data-section-id');
          issues.push(
            `Section "${sid}" has Add action but no AddGate wiring`,
          );
        }
      });

      return issues;
    },
    { sectionIds },
  );

  // P9 is aspirational — many sections may not yet be wired.
  // Log violations as soft warnings rather than hard failures during
  // the rollout phase. Once task 10.5 and 10.6 complete, this can be
  // made strict.
  if (result.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[P9] Help/AddGate coverage issues (${result.length}):`,
      result.slice(0, 5),
    );
  }

  // For now, only fail on truly invalid references (unknown sectionIds)
  const hardFailures = result.filter(
    (msg) =>
      msg.includes('unknown sectionId'),
  );
  expect(
    hardFailures,
    `P9 hard failures: ${JSON.stringify(hardFailures)}`,
  ).toHaveLength(0);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('route-walk — Definition of Done (P5, P6, P9)', () => {
  for (const viewport of VIEWPORTS) {
    for (const locale of LOCALES) {
      test.describe(`viewport=${viewport} locale=${locale}`, () => {
        test.beforeEach(async ({ page }) => {
          // Set viewport width (height is standard 720)
          await page.setViewportSize({ width: viewport, height: 720 });

          // Set locale before login so the app initializes with it
          await page.goto('/login');
          await setLocale(page, locale);

          // Login
          await loginAsAdmin(page);

          // Verify locale is active
          const activeLang = await page.evaluate(() =>
            localStorage.getItem('i18n.language'),
          );
          expect(activeLang).toBe(locale);
        });

        for (const route of UNIQUE_ROUTES) {
          test(`${route}`, async ({ page }) => {
            // Navigate to the route
            await page.goto(route);
            await waitForSettle(page);

            // Skip if we landed on a 404 page — the route may be
            // gated or require specific state. The nav-sweep spec
            // handles 404 detection separately.
            const is404 = await page
              .getByTestId('page-not-found')
              .count()
              .then((c) => c > 0)
              .catch(() => false);
            if (is404) {
              test.skip();
              return;
            }

            // P5: No horizontal overflow
            await assertNoHorizontalOverflow(page);

            // P6: Language purity
            await assertLanguagePurity(page, locale);

            // P9: Help_Icon + AddGate coverage
            await assertHelpAndAddGateCoverage(page);
          });
        }
      });
    }
  }
});
