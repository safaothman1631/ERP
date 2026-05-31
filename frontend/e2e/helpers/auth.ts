import { type Page } from '@playwright/test';

// Cache token across tests in same worker to avoid hitting auth rate limit (5/min)
let cachedToken: { access_token: string; user_id: string; org_id: string; user_name?: string } | null = null;

function apiBaseUrl(): string {
  return (
    process.env.API_BASE_URL ||
    process.env.PLAYWRIGHT_API_URL ||
    'http://localhost:8000'
  );
}

function e2eCredentials(): { email: string; password: string } {
  return {
    email: process.env.E2E_EMAIL || 'admin@test.com',
    password: process.env.E2E_PASSWORD || '123456',
  };
}

async function fetchToken(page: Page) {
  if (cachedToken) return cachedToken;
  const { email, password } = e2eCredentials();
  const res = await page.request.post(`${apiBaseUrl()}/api/auth/login`, {
    data: { email, password },
  });
  if (!res.ok()) {
    throw new Error(`Login API failed: ${res.status()} ${await res.text()}`);
  }
  cachedToken = await res.json();
  return cachedToken!;
}

/**
 * Test helper: login as admin via API (cached) + inject token into localStorage.
 */
export async function loginAsAdmin(page: Page) {
  const body = await fetchToken(page);
  await page.goto('/login');
  await page.evaluate((data) => {
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('userId', data.user_id);
    localStorage.setItem('orgId', data.org_id);
    localStorage.setItem('userName', data.user_name || 'admin');
  }, body);
  await page.goto('/');
  await page.waitForURL(/\/(?!login)/, { timeout: 10_000 });
}
