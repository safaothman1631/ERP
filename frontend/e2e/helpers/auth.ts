import { test, expect, type Page } from '@playwright/test';

/**
 * Test helper: login as admin + return authenticated page.
 */
export async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder(/email/i).fill('admin@test.com');
  await page.getByPlaceholder(/password|وشە/i).fill('123456');
  await page.getByRole('button', { name: /sign in|چوونەژوور|login/i }).click();
  await page.waitForURL(/\/(?!login)/, { timeout: 10_000 });
}
