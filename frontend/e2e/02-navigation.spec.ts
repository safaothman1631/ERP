import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Smoke — Navigation', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });

  test('can reach Invoices list', async ({ page }) => {
    await page.goto('/invoices');
    await expect(page).toHaveURL(/\/invoices$/);
  });

  test('can reach Bills list', async ({ page }) => {
    await page.goto('/bills');
    await expect(page).toHaveURL(/\/bills$/);
  });

  test('can reach Contacts list', async ({ page }) => {
    await page.goto('/contacts');
    await expect(page).toHaveURL(/\/contacts$/);
  });
});
