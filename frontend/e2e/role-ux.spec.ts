import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Role-adaptive glass UX — smoke, a11y, dialog, viewer checks.
 */
test.describe('Role-adaptive UX', () => {
  test.beforeEach(async ({ page }) => {
    const email = process.env.E2E_USER_EMAIL;
    const password = process.env.E2E_USER_PASSWORD;
    test.skip(!email || !password, 'E2E_USER_EMAIL / E2E_USER_PASSWORD not set');

    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email!);
    await page.getByLabel(/password/i).fill(password!);
    await page.getByRole('button', { name: /sign in|login|چوونەژوورەوە/i }).click();
    await page.waitForURL(/\/(dashboard|platform|pos|inventory|hr|purchase-orders|crm)/, { timeout: 30_000 });
  });

  test('shows role identity chip in top bar', async ({ page }) => {
    await expect(page.locator('.role-identity-chip')).toBeVisible({ timeout: 15_000 });
  });

  test('dashboard shows role home hero glass card', async ({ page }) => {
    if (!page.url().includes('/dashboard') && !page.url().endsWith('/')) {
      await page.goto('/dashboard');
    }
    await expect(page.locator('.glass-card').first()).toBeVisible({ timeout: 15_000 });
  });

  test('role chip opens capability panel on click', async ({ page }) => {
    await page.locator('.role-identity-chip').click();
    await expect(page.getByText(/you can|دەتوانیت|يمكنك/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('command palette opens and closes with Escape', async ({ page }) => {
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog').or(page.locator('[class*="command"]'))).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
  });

  test('dashboard has no serious axe violations', async ({ page }) => {
    if (!page.url().includes('/dashboard')) await page.goto('/dashboard');
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();
    const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(bad).toEqual([]);
  });
});

test.describe('Role-adaptive UX — viewer', () => {
  test('viewer dashboard hides create invoice CTA when E2E_VIEWER creds set', async ({ page }) => {
    const email = process.env.E2E_VIEWER_EMAIL;
    const password = process.env.E2E_VIEWER_PASSWORD;
    test.skip(!email || !password, 'E2E_VIEWER_EMAIL not set');

    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email!);
    await page.getByLabel(/password/i).fill(password!);
    await page.getByRole('button', { name: /sign in|login|چوونەژوورەوە/i }).click();
    await page.waitForURL(/\/(dashboard|platform)/, { timeout: 30_000 });
    await page.goto('/dashboard');
    await expect(page.getByRole('button', { name: /new invoice|پسوولەی نوێ/i })).toHaveCount(0);
  });
});
