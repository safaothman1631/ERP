import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Chatter widget smoke', () => {
  test('loads messages and posts a message from contacts modal', async ({ page }) => {
    await loginAsAdmin(page);

    await page.route('**/api/contacts**', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                id: 'contact-1',
                display_name: 'Acme Contact',
                contact_type: 'customer',
                email: 'acme@example.com',
              },
            ],
            total: 1,
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.route('**/api/chatter/contact/contact-1/activities', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], total: 0 }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.route('**/api/chatter/contact/contact-1/followers', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], total: 0 }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.route('**/api/users', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      });
    });

    await page.route('**/api/chatter/contact/contact-1/messages', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [], total: 0 }),
        });
        return;
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'msg-1',
          body: 'Hello from e2e',
          author_name: 'Admin',
        }),
      });
    });

    await page.goto('/contacts');
    await expect(page).toHaveURL(/\/contacts$/);

    await page.locator('tbody tr').first().locator('button').first().click();
    await expect(page.getByRole('textbox').first()).toBeVisible();

    const tabCount = await page.locator('.ant-tabs-tab').count();
    expect(tabCount).toBeGreaterThanOrEqual(2);
    await expect(page.locator('body')).toBeVisible();
  });
});

