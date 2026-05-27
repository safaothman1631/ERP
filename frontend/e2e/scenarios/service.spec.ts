import { test, expect } from '@playwright/test';

test.describe('Service company scenario (smoke)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', process.env.E2E_EMAIL || 'admin@demo.com');
    await page.fill('input[type="password"]', process.env.E2E_PASSWORD || 'demo1234');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|invoices|home)/, { timeout: 15000 }).catch(() => {});
  });

  test('quotes, projects, and CRM reachable', async ({ page }) => {
    for (const path of ['/quotes', '/projects', '/crm/leads']) {
      await page.goto(path);
      await expect(page.locator('body')).not.toContainText('404');
    }
  });
});
