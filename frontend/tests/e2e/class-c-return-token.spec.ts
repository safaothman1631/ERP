/**
 * class-c-return-token.spec.ts — EP-5 Class C round-trip verification.
 *
 * The Class C pattern (per design.md §3.3) is used for entities that are too
 * complex for a quick-create modal/drawer. The lone Class C entity in the
 * empty-state audit is Employee. The round-trip:
 *
 *   1. User opens TicketDetail and clicks "Assign" → assigned-to selector opens.
 *   2. Employee list is empty → empty-state CTA "Add new employee" is visible.
 *   3. User clicks the CTA → `saveReturnContext()` persists a token to
 *      sessionStorage and the app navigates to
 *      `/hr/employees?returnTo=<token>&autoOpen=1`.
 *   4. HREmployees auto-opens the create form. User fills + saves.
 *   5. On save, `restoreReturnContext()` reads the token and the app navigates
 *      back to TicketDetail with `?newEmployeeId=<id>&consumedToken=<token>`.
 *   6. TicketDetail re-opens the assign dialog with the new employee selected.
 *
 * Behaviour:
 *   - Skipped by default. Set `RUN_CLASS_C_E2E=1` to opt in.
 *   - Requires backend reachable (proxy at /api → 127.0.0.1:8000) and at least
 *     one ticket id present. Network calls are stubbed where deterministic
 *     fixtures matter.
 *
 * Local usage:
 *   RUN_CLASS_C_E2E=1 npx playwright test tests/e2e/class-c-return-token.spec.ts
 *
 * Owner: EP-5 Subform + Class C Specialist.
 */

import { test, expect, type Page, type Route } from '@playwright/test';

const RUN = process.env.RUN_CLASS_C_E2E === '1';

const TICKET_ID = 'class-c-ticket-1';
const TICKET_FIXTURE = {
  id: TICKET_ID,
  subject: 'Test ticket for Class C round-trip',
  description: 'Created by Playwright',
  status: 'open',
  priority: 'normal',
  created_at: new Date().toISOString(),
};

async function stubTicketAndEmptyEmployees(page: Page) {
  await page.route(`**/api/helpdesk/tickets/${TICKET_ID}`, (route: Route) => {
    if (route.request().method() !== 'GET') return route.continue();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TICKET_FIXTURE),
    });
  });
  await page.route(`**/api/helpdesk/tickets/${TICKET_ID}/replies**`, (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    }),
  );

  // First call to /api/hr/employees returns empty so the empty-state shows.
  // After the round-trip, the page re-fetches and we'll inject the new record.
  let employeesCallCount = 0;
  await page.route('**/api/hr/employees**', (route: Route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      employeesCallCount += 1;
      if (employeesCallCount === 1) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [] }),
        });
      }
      // Subsequent calls (after create) return the newly-created employee.
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [{ id: 'emp-new-1', name: 'Sara Newhire', email: 'sara@example.com' }],
        }),
      });
    }
    if (req.method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'emp-new-1', name: 'Sara Newhire' }),
      });
    }
    return route.continue();
  });

  // Departments — empty is fine.
  await page.route('**/api/hr/departments**', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    }),
  );

  // Assign endpoint — succeed.
  await page.route(`**/api/helpdesk/tickets/${TICKET_ID}/assign`, (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );
}

test.describe('EP-5: Class C navigate-with-return-token (Employee)', () => {
  test.skip(!RUN, 'set RUN_CLASS_C_E2E=1 to enable');

  test.beforeEach(async ({ page }) => {
    await stubTicketAndEmptyEmployees(page);
  });

  test('full round-trip: empty selector → quick-add CTA → fill employee → return + selected', async ({ page }) => {
    await page.goto(`/helpdesk/tickets/${TICKET_ID}`);

    // 1. Open the assign dialog
    await page.getByRole('button', { name: /assign|بنیادنە|تعیین/i }).first().click();

    // 2. Click the assigned-to select to open dropdown
    await page.getByTestId('assigned-to-select').click();

    // 3. Empty state + CTA visible
    const cta = page.getByTestId('quick-create-employee').first();
    await expect(cta).toBeVisible();

    // 4. Click CTA — should navigate to /hr/employees with returnTo token
    await cta.click();

    await expect(page).toHaveURL(/\/hr\/employees\?returnTo=[^&]+&autoOpen=1/);

    // The return-hint banner should be visible.
    await expect(page.getByTestId('return-context-hint')).toBeVisible();

    // The create-employee FormDialog should be auto-opened.
    const nameInput = page.getByLabel(/name|ناو|الاسم/i).first();
    await expect(nameInput).toBeVisible();

    // 5. Fill + save
    await nameInput.fill('Sara Newhire');

    // Click the dialog OK button.
    await page.getByRole('button', { name: /^(ok|save|نوێکردنەوە|پاشەکەوت)/i }).click();

    // 6. URL should bounce back to the ticket detail with the new id appended.
    await expect(page).toHaveURL(
      new RegExp(`/helpdesk/tickets/${TICKET_ID}\\?newEmployeeId=emp-new-1`),
    );

    // 7. Assign dialog re-opens with the new employee pre-selected.
    await expect(page.getByTestId('assigned-to-select')).toBeVisible();
    await expect(page.getByText('Sara Newhire')).toBeVisible();
  });

  test('return-token expires after 1 hour and source state is dropped', async ({ page, context }) => {
    await page.goto(`/helpdesk/tickets/${TICKET_ID}`);
    await page.getByRole('button', { name: /assign/i }).first().click();
    await page.getByTestId('assigned-to-select').click();
    await page.getByTestId('quick-create-employee').first().click();

    // Pull the token out of the URL and manually expire it in sessionStorage.
    const url = new URL(page.url());
    const token = url.searchParams.get('returnTo');
    expect(token).toBeTruthy();

    // Force-expire it.
    await page.evaluate((t) => {
      const key = `zoho:returnContext:${t}`;
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const obj = JSON.parse(raw);
        obj.expiresAt = Date.now() - 1000;
        sessionStorage.setItem(key, JSON.stringify(obj));
      }
    }, token!);

    // The hint banner should *not* be shown after expiry (re-load).
    await page.reload();
    await expect(page.getByTestId('return-context-hint')).toHaveCount(0);
  });
});
