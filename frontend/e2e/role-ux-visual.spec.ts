import { test, expect } from '@playwright/test';

/**
 * Visual regression snapshots for role-adaptive dashboard (C13).
 * Run with: E2E_USER_EMAIL=... E2E_USER_PASSWORD=... npx playwright test role-ux-visual
 */
test.describe('Role home visual baseline', () => {
  test('dashboard role hero snapshot', async ({ page }) => {
    const email = process.env.E2E_USER_EMAIL;
    const password = process.env.E2E_USER_PASSWORD;
    test.skip(!email || !password, 'credentials not set');

    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email!);
    await page.getByLabel(/password/i).fill(password!);
    await page.getByRole('button', { name: /sign in|login|چوونەژوورەوە/i }).click();
    await page.waitForURL(/\/(dashboard|platform|pos|crm|inventory|hr|purchase-orders)/, { timeout: 30_000 });

    if (!page.url().includes('/dashboard') && !page.url().endsWith('/')) {
      await page.goto('/dashboard');
    }

    await page.waitForSelector('.glass-card', { timeout: 15_000 });
    await expect(page).toHaveScreenshot('role-dashboard-hero.png', {
      maxDiffPixelRatio: 0.08,
      fullPage: false,
    });
  });
});
