import { test, expect } from '@playwright/test';

const DEMO_PASSWORD = 'Demo@2026';
const API_BASE = process.env.PLAYWRIGHT_API_URL || 'http://localhost:8000';

const PRIVILEGED_2FA = new Set(['owner', 'admin', 'accountant']);

const DEMO_USERS: { role: string; email: string; path: string; urlPattern: RegExp }[] = [
  { role: 'owner', email: 'demo-owner@zohoerp.example.com', path: '/settings?s=security', urlPattern: /\/settings\?s=security/ },
  { role: 'admin', email: 'demo-admin@zohoerp.example.com', path: '/settings?s=security', urlPattern: /\/settings\?s=security/ },
  { role: 'manager', email: 'demo-manager@zohoerp.example.com', path: '/dashboard', urlPattern: /\/dashboard/ },
  { role: 'accountant', email: 'demo-accountant@zohoerp.example.com', path: '/settings?s=security', urlPattern: /\/settings\?s=security/ },
  { role: 'sales_rep', email: 'demo-sales@zohoerp.example.com', path: '/crm/leads', urlPattern: /\/crm\/leads/ },
  { role: 'purchaser', email: 'demo-purchaser@zohoerp.example.com', path: '/purchase-orders', urlPattern: /\/purchase-orders/ },
  { role: 'inventory_manager', email: 'demo-inventory@zohoerp.example.com', path: '/inventory', urlPattern: /\/inventory/ },
  { role: 'cashier', email: 'demo-cashier@zohoerp.example.com', path: '/pos', urlPattern: /\/pos/ },
  { role: 'hr', email: 'demo-hr@zohoerp.example.com', path: '/hr', urlPattern: /\/hr/ },
  { role: 'project_manager', email: 'demo-projects@zohoerp.example.com', path: '/projects', urlPattern: /\/projects/ },
  { role: 'viewer', email: 'demo-viewer@zohoerp.example.com', path: '/dashboard', urlPattern: /\/dashboard/ },
  { role: 'user', email: 'demo-user@zohoerp.example.com', path: '/dashboard', urlPattern: /\/dashboard/ },
];

async function loginViaApi(
  page: import('@playwright/test').Page,
  email: string,
  destPath: string,
) {
  const response = await page.request.post(`${API_BASE}/api/auth/login`, {
    data: { email, password: DEMO_PASSWORD },
  });
  expect(response.ok(), `login failed for ${email}: ${response.status()}`).toBeTruthy();
  const data = await response.json();

  const path = data.requires_2fa_setup ? '/settings?s=security' : destPath;

  await page.goto('/login');
  await page.evaluate((payload) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('token', payload.access_token);
    localStorage.setItem('userId', payload.user_id);
    localStorage.setItem('orgId', payload.org_id);
    localStorage.setItem('userName', payload.user_name || '');
    if (payload.role) localStorage.setItem('userRole', payload.role);
  }, data);

  await page.goto(path);
}

test.describe('Demo role users — login smoke', () => {
  test('all 12 demo roles log in without onboarding wizard', async ({ page }) => {
    test.setTimeout(180_000);

    for (const { role, email, path, urlPattern } of DEMO_USERS) {
      await loginViaApi(page, email, path);
      await page.waitForURL(urlPattern, { timeout: 30_000 });

      await expect(page.locator('.onboarding-wizard, [class*="OnboardingWizard"]')).toHaveCount(0);

      if (PRIVILEGED_2FA.has(role)) {
        await expect(page).toHaveURL(/\/settings\?s=security/);
      } else {
        await expect(page.locator('.role-identity-chip')).toBeVisible({ timeout: 15_000 });
      }

      await page.goto('/login');
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    }
  });
});
