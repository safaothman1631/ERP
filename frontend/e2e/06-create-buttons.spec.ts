import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

/**
 * Regression: list-page "New X" buttons must open a create modal,
 * not navigate to non-existent /X/new routes (404).
 * Bug discovered: Contacts/Bills/Expenses navigated to dead routes.
 */
test.describe('Smoke — List-page "New" buttons open modals', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });

  for (const route of ['/contacts', '/bills', '/expenses']) {
    test(`${route} "New" button opens modal (not 404)`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`${route}$`));
      // Click the primary "New" button at top-right of the page header
      await page.locator('button.ant-btn-primary').first().click();
      // Confirm we did NOT navigate away
      await expect(page).toHaveURL(new RegExp(`${route}$`));
      // Confirm a modal opened
      await expect(page.locator('.ant-modal').first()).toBeVisible({ timeout: 4000 });
    });
  }
});
