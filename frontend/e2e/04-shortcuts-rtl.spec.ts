import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Smoke — Shortcuts + RTL', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });

  test('? opens shortcut cheatsheet', async ({ page }) => {
    await page.goto('/');
    // Dispatch a synthetic '?' keydown directly to window — bypasses focus + i18n keyboard layout issues
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
    });
    await expect(page.locator('.ant-modal-title').first()).toBeVisible({ timeout: 4000 });
  });

  test('document direction is RTL by default (ku)', async ({ page }) => {
    await page.goto('/');
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe('rtl');
  });
});
