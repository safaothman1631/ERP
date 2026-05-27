import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers/auth';

/** @deprecated Use shopkeeper_core.spec.ts — kept for Phase 6 path compatibility */
test.describe('Scenario smoke - retail (shopkeeper alias)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('navigates key retail modules', async ({ page }) => {
    const routes = ['/pos', '/pos/orders', '/items', '/invoices', '/purchase-orders', '/banking'];
    for (const path of routes) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, '\\/')}$`));
    }
  });
});
