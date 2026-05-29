import { test, expect } from '@playwright/test';

test.describe('Restaurant business scenario (smoke)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', process.env.E2E_EMAIL || 'admin@demo.com');
    await page.fill('input[type="password"]', process.env.E2E_PASSWORD || 'demo1234');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|invoices|home)/, { timeout: 15000 }).catch(() => {});
  });

  test('navigate to POS and restaurant modules', async ({ page }) => {
    await page.goto('/pos/orders');
    await expect(page.locator('body')).not.toContainText('404');
    await page.goto('/restaurant');
    await expect(page.locator('body')).not.toContainText('404');
  });
});
