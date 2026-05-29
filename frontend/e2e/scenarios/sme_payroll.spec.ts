import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers/auth';

test.describe('Scenario smoke - sme payroll', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('navigates HR and payroll surfaces', async ({ page }) => {
    await page.goto('/hr');
    await expect(page).toHaveURL(/\/hr$/);

    await page.goto('/hr/employees');
    await expect(page).toHaveURL(/\/hr\/employees$/);

    await page.goto('/payroll/runs');
    await expect(page).toHaveURL(/\/payroll\/runs$/);
  });
});

