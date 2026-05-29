import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers/auth';

test.describe('Module licensing — request workflow smoke', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('license API and module requests page load', async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem('token'));
    test.skip(!token, 'No auth token — backend may be offline');

    const licenseRes = await request.get('/api/onboarding/license', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(licenseRes.status()).toBeLessThan(500);
    if (licenseRes.ok()) {
      const body = await licenseRes.json();
      expect(body).toHaveProperty('require_module_approval');
    }

    await page.goto('/settings/module-requests');
    await expect(page.getByText(/Module requests|داواکاری مۆدیول/i)).toBeVisible({ timeout: 15000 });
  });
});
