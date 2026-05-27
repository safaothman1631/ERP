/**
 * rtl-snapshots — Phase P5.
 *
 * Visual regression for RTL languages (Kurdish + Arabic) on the most
 * traffic-heavy routes. Validates R9.4.
 *
 * Behaviour:
 *   - Skipped by default in CI. Set `RUN_RTL_SNAPSHOTS=1` to opt in.
 *   - Run with `--update-snapshots` to regenerate baselines.
 *   - Compares against per-locale baseline images stored next to the spec
 *     under `rtl-snapshots.spec.ts-snapshots/`.
 *
 * Local usage:
 *   RUN_RTL_SNAPSHOTS=1 npx playwright test tests/e2e/rtl-snapshots.spec.ts
 *   RUN_RTL_SNAPSHOTS=1 npx playwright test tests/e2e/rtl-snapshots.spec.ts --update-snapshots
 */

import { test, expect, type Page } from '@playwright/test';

const RUN = process.env.RUN_RTL_SNAPSHOTS === '1';

const LANGS = ['ku', 'ar'] as const;

/**
 * Top 10 critical routes to baseline. This is a subset of the spec's "top 30";
 * expand as the migration progresses.
 */
const ROUTES = [
  { path: '/', name: 'home' },
  { path: '/login', name: 'login' },
  { path: '/dashboard', name: 'dashboard' },
  { path: '/invoices', name: 'invoices' },
  { path: '/bills', name: 'bills' },
  { path: '/contacts', name: 'contacts' },
  { path: '/items', name: 'items' },
  { path: '/pos/terminal', name: 'pos-terminal' },
  { path: '/settings', name: 'settings' },
  { path: '/reports', name: 'reports' },
] as const;

/**
 * Force the language without depending on a UI affordance.
 * Sets the spec-required localStorage key (`i18n.language`) and reloads.
 */
async function setLanguage(page: Page, lang: 'ku' | 'ar' | 'en'): Promise<void> {
  await page.addInitScript((l) => {
    try {
      window.localStorage.setItem('i18n.language', l);
    } catch {
      /* ignore */
    }
  }, lang);
}

test.describe('RTL snapshot suite', () => {
  test.skip(!RUN, 'RTL snapshot suite is gated behind RUN_RTL_SNAPSHOTS=1');

  // Tighten the diff threshold but allow tiny anti-aliasing drift.
  test.use({
    viewport: { width: 1366, height: 900 },
  });

  for (const lang of LANGS) {
    for (const route of ROUTES) {
      test(`${lang} — ${route.name} (${route.path})`, async ({ page }) => {
        await setLanguage(page, lang);
        await page.goto(route.path, { waitUntil: 'networkidle' });

        // Verify the document direction is RTL — fails fast if i18n didn't load.
        const dir = await page.evaluate(() => document.documentElement.dir);
        expect(dir, `expected dir=rtl for ${lang}`).toBe('rtl');

        // Wait for fonts so glyph shaping stabilizes.
        await page.evaluate(() => document.fonts?.ready);

        // Mask volatile regions (timestamps, "now" indicators) so the diff
        // is meaningful. Selectors are best-effort; missing nodes are fine.
        const mask = [
          page.locator('[data-testid="now"]'),
          page.locator('[data-volatile="true"]'),
          page.locator('time'),
        ];

        await expect(page).toHaveScreenshot(`${lang}-${route.name}.png`, {
          fullPage: true,
          animations: 'disabled',
          mask,
          maxDiffPixelRatio: 0.02,
        });
      });
    }
  }
});
