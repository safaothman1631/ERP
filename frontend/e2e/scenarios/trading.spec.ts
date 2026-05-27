import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers/auth';

test.describe('Scenario smoke - trading', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('navigates trading modules', async ({ page }) => {
    await page.goto('/quotes');
    await expect(page).toHaveURL(/\/quotes$/);

    await page.goto('/sales-orders');
    await expect(page).toHaveURL(/\/sales-orders$/);

    await page.goto('/purchase-orders');
    await expect(page).toHaveURL(/\/purchase-orders$/);

    await page.goto('/bills');
    await expect(page).toHaveURL(/\/bills$/);

    await page.goto('/banking');
    await expect(page).toHaveURL(/\/banking$/);
  });
});

