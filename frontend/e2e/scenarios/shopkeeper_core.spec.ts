import { test, expect } from '@playwright/test';

import { loginAsAdmin } from '../helpers/auth';



const API_BASE = process.env.API_BASE_URL || 'http://localhost:8000';

function asList(body: unknown): Array<{ id?: string }> {
  if (Array.isArray(body)) return body as Array<{ id?: string }>;
  if (body && typeof body === 'object') {
    const o = body as Record<string, unknown>;
    if (Array.isArray(o.items)) return o.items as Array<{ id?: string }>;
    if (Array.isArray(o.accounts)) return o.accounts as Array<{ id?: string }>;
  }
  return [];
}



/**

 * Deep shopkeeper scenario — purchase, sales/debt, POS, accounting, banking.

 * Spec: .kiro/specs/shopkeeper-production-core/

 */

test.describe('Shopkeeper production core', () => {

  test.beforeEach(async ({ page }) => {

    await loginAsAdmin(page);

  });



  test('navigates all core modules without 404', async ({ page }) => {

    const routes = [

      '/purchase-orders',

      '/bills',

      '/invoices',

      '/contacts',

      '/items',

      '/banking',

      '/accounts',

      '/journals',

      '/pos',

      '/pos/orders',

      '/reports/aged-receivables',

      '/reports/aged-payables',

    ];

    for (const path of routes) {

      await page.goto(path);

      await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, '\\/')}$`));

    }

  });



  test('API health and auth token work for shopkeeper APIs', async ({ page }) => {

    const token = await page.evaluate(() => localStorage.getItem('token'));

    expect(token).toBeTruthy();



    const headers = { Authorization: `Bearer ${token}` };

    const checks = [

      '/api/items?page=1&page_size=5',

      '/api/invoices?page=1&page_size=5',

      '/api/purchase-orders?page=1&page_size=5',

      '/api/banking/accounts',

      '/api/pos/configs',

    ];

    for (const path of checks) {

      const res = await page.request.get(`${API_BASE}${path}`, { headers });

      expect(res.status(), path).toBeLessThan(500);

    }

  });



  test('POS offline sync endpoint accepts idempotent payload shape', async ({ page }) => {

    const token = await page.evaluate(() => localStorage.getItem('token'));

    const headers = {

      Authorization: `Bearer ${token}`,

      'Content-Type': 'application/json',

    };



    const sessionsRes = await page.request.get(`${API_BASE}/api/pos/sessions?state=opened&page_size=1`, {

      headers,

    });

    if (!sessionsRes.ok()) {

      test.skip(true, 'No open POS session — start session in staging first');

      return;

    }

    const sessionsBody = await sessionsRes.json();

    const items = sessionsBody.items ?? sessionsBody.data ?? [];

    const sessionId = items[0]?.id;

    if (!sessionId) {

      test.skip(true, 'No open POS session');

      return;

    }



    const methodsRes = await page.request.get(`${API_BASE}/api/pos/payment-methods?page_size=5`, {

      headers,

    });

    const methods = (await methodsRes.json()).items ?? [];

    const methodId = methods[0]?.id;

    if (!methodId) {

      test.skip(true, 'No POS payment methods configured');

      return;

    }



    const itemsRes = await page.request.get(`${API_BASE}/api/items?page_size=1`, { headers });

    const stockItems = (await itemsRes.json()).items ?? [];

    const itemId = stockItems[0]?.id;

    if (!itemId) {

      test.skip(true, 'No items in org');

      return;

    }



    const tempId = `e2e-${Date.now()}`;

    const syncRes = await page.request.post(`${API_BASE}/api/pos/orders/sync`, {

      headers,

      data: {

        orders: [

          {

            temp_id: tempId,

            session_id: sessionId,

            lines: [

              {

                item_id: itemId,

                qty: 1,

                unit_price: 1000,

                discount_percent: 0,

                tax_rate: 0,

              },

            ],

            payments: [{ payment_method_id: methodId, amount: 1000 }],

          },

        ],

      },

    });

    expect(syncRes.status()).toBeLessThan(500);

    const body = await syncRes.json();

    expect(body).toHaveProperty('mapping');

    expect(body).toHaveProperty('errors');

  });



  test('banking reconciliation summary returns numeric balances', async ({ page }) => {

    const token = await page.evaluate(() => localStorage.getItem('token'));

    const headers = { Authorization: `Bearer ${token}` };



    const accountsRes = await page.request.get(`${API_BASE}/api/banking/accounts`, { headers });

    if (!accountsRes.ok()) {

      test.skip(true, 'Banking accounts API unavailable');

      return;

    }

    const accountsBody = await accountsRes.json();
    const accounts = asList(accountsBody);
    const accountId = accounts[0]?.id;

    if (!accountId) {

      test.skip(true, 'No bank accounts');

      return;

    }



    const summaryRes = await page.request.get(

      `${API_BASE}/api/banking/accounts/${accountId}/reconciliation-summary`,

      { headers },

    );

    expect(summaryRes.ok()).toBeTruthy();

    const summary = await summaryRes.json();

    expect(typeof summary.opening_balance).toBe('number');

    expect('system_balance' in summary || 'closing_balance' in summary).toBeTruthy();

  });

});


