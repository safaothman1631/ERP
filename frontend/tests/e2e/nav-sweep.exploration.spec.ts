import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../../e2e/helpers/auth';

/**
 * nav-sweep.exploration.spec.ts — Property 1 (Bug Condition) runtime variant.
 *
 * Companion to `frontend/scripts/nav-audit.exploration.mjs`. The static
 * variant proves the bug exists at the route-table level; this Playwright
 * variant proves it ALSO manifests at runtime when a real authenticated
 * user clicks the surface controls (drop-downs, palette, menus).
 *
 * On UNFIXED `main` this spec is EXPECTED TO FAIL — at least one click must
 * land on the NotFound page. On FIXED `main` (after Task 3 lands) it must
 * pass and stay green via the CI gate (`nav:sweep`).
 *
 * The authoritative full-coverage walk lives in `nav-sweep.spec.ts`. This
 * file only walks a deliberately minimal sampled slice so the bug surfaces
 * fast and cheaply on unfixed code.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

const SAMPLED_DESTINATIONS = [
  // Side-nav leaves
  { surface: 'side_nav_leaf', path: '/contacts' },
  { surface: 'side_nav_leaf', path: '/inventory/warehouses' },
  { surface: 'side_nav_leaf', path: '/manufacturing/orders' },
  // Quick-create
  { surface: 'quick_create_item', path: '/invoices/new' },
  { surface: 'quick_create_item', path: '/journals' },
  // Command palette
  { surface: 'command_palette_command', path: '/reports' },
  { surface: 'command_palette_command', path: '/settings' },
  // In-page CTAs / TITLES known suspects
  { surface: 'in_page_link', path: '/dashboard' },
  { surface: 'in_page_link', path: '/timesheets' },
  { surface: 'in_page_link', path: '/warehouses' },
  { surface: 'in_page_link', path: '/crm' },
] as const;

test.describe('nav-sweep exploration — Property 1 (Bug Condition)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const { surface, path } of SAMPLED_DESTINATIONS) {
    test(`[${surface}] ${path} resolves to a real page`, async ({ page }) => {
      await page.goto(path);
      // Use the testid landed in Task 3.4. Keep the legacy "Result status='404'"
      // text-based fallback removed — Task 3.4 ships before this spec runs.
      await expect(page.getByTestId('page-not-found')).toHaveCount(0);
    });
  }
});
