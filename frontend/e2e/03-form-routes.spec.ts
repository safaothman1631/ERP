import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Smoke — Dedicated form routes (Sprint 7-9)', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });

  // Only routes that have dedicated /new pages with FormLayout (Sprint 7-9 scope).
  // Bills, contacts, and expenses still use list-page modals — to be migrated in a future sprint.
  for (const path of ['/invoices/new', '/items/new', '/quotes/new']) {
    test(`form route ${path} renders FormLayout`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(path.replace('/', '\\/')));
      // FormLayout adds a sticky save bar with role=region or buttons
      await expect(page.locator('button').filter({ hasText: /save|پاشەکەوت|cancel|پاشگەزبوون/i }).first()).toBeVisible({ timeout: 8000 });
    });
  }
});
