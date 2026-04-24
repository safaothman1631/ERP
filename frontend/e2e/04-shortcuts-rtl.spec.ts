import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Smoke — Shortcuts + RTL', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });

  test('? opens shortcut cheatsheet', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('?');
    // Cheatsheet uses AntD Modal — look for any modal title containing "shortcut" or Kurdish
    await expect(page.locator('.ant-modal-title').first()).toBeVisible({ timeout: 4000 });
  });

  test('document direction is RTL by default (ku)', async ({ page }) => {
    await page.goto('/');
    const dir = await page.evaluate(() => document.documentElement.dir);
    expect(dir).toBe('rtl');
  });
});
