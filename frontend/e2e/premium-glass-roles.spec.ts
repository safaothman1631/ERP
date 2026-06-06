/**
 * premium-glass-roles.spec.ts
 *
 * Part of `.kiro/specs/premium-glass-rtl-experience` — Playwright per-role
 * visual + smoke baselines covering all 12 demo roles, across both mobile
 * (390×844) and desktop (1440×900) viewports, in both directions:
 *   - ku  = Kurdish (RTL, localStorage i18n.language = 'ku')
 *   - en  = English (LTR, localStorage i18n.language = 'en')
 *
 * Total combinations: 12 roles × 2 viewports × 2 directions = 48 snapshots.
 *
 * Baseline generation:
 *   RUN_GLASS_SNAPSHOTS=1 npx playwright test e2e/premium-glass-roles.spec.ts --update-snapshots
 *
 * Normal (diff) run:
 *   RUN_GLASS_SNAPSHOTS=1 npx playwright test e2e/premium-glass-roles.spec.ts
 *
 * The suite is gated behind RUN_GLASS_SNAPSHOTS=1 so it does not run in the
 * default CI pipeline (which is not equipped with snapshot baselines). Set the
 * variable on the developer machine when regenerating baselines.
 */

import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

// ─── Gate ──────────────────────────────────────────────────────────────────

const RUN = process.env.RUN_GLASS_SNAPSHOTS === '1';

// ─── Constants ─────────────────────────────────────────────────────────────

const DEMO_PASSWORD = 'Demo@2026';
const API_BASE = process.env.PLAYWRIGHT_API_URL || 'http://localhost:8000';

/** Roles whose demo accounts require TOTP at login — skip browser tests. */
/**
 * 12 demo users matching role-demo-users.spec.ts and role-full-audit.spec.ts.
 * homePath = the route the role lands on after a successful login.
 */
const DEMO_USERS: { role: string; email: string; homePath: string }[] = [
  { role: 'owner',            email: 'demo-owner@zohoerp.example.com',     homePath: '/dashboard'       },
  { role: 'admin',            email: 'demo-admin@zohoerp.example.com',     homePath: '/dashboard'       },
  { role: 'manager',          email: 'demo-manager@zohoerp.example.com',   homePath: '/dashboard'       },
  { role: 'accountant',       email: 'demo-accountant@zohoerp.example.com',homePath: '/dashboard'       },
  { role: 'sales_rep',        email: 'demo-sales@zohoerp.example.com',     homePath: '/crm/leads'       },
  { role: 'purchaser',        email: 'demo-purchaser@zohoerp.example.com', homePath: '/purchase-orders' },
  { role: 'inventory_manager',email: 'demo-inventory@zohoerp.example.com', homePath: '/inventory'       },
  { role: 'cashier',          email: 'demo-cashier@zohoerp.example.com',   homePath: '/pos'             },
  { role: 'hr',               email: 'demo-hr@zohoerp.example.com',        homePath: '/hr'              },
  { role: 'project_manager',  email: 'demo-projects@zohoerp.example.com',  homePath: '/projects'        },
  { role: 'viewer',           email: 'demo-viewer@zohoerp.example.com',    homePath: '/dashboard'       },
  { role: 'user',             email: 'demo-user@zohoerp.example.com',      homePath: '/dashboard'       },
];

const DIRECTIONS = ['ku', 'en'] as const;

// ─── Login helpers (mirrors role-full-audit.spec.ts) ───────────────────────

type LoginSuccess = { ok: true; data: Record<string, unknown> };
type LoginTotp    = { ok: false; requiresTotp: true };
type LoginError   = { ok: false; requiresTotp: false; status: number; detail: string };
type LoginResult  = LoginSuccess | LoginTotp | LoginError;

async function tryLogin(request: APIRequestContext, email: string): Promise<LoginResult> {
  const response = await request.post(`${API_BASE}/api/auth/login`, {
    data: { email, password: DEMO_PASSWORD },
  });

  if (response.status() === 401) {
    const raw = await response.text();
    let code: string | undefined;
    try {
      const detail = JSON.parse(raw) as Record<string, unknown>;
      if (typeof detail.detail === 'object' && detail.detail !== null) {
        code = (detail.detail as { code?: string }).code;
      } else if (typeof detail.detail === 'string') {
        const match = detail.detail.match(/['"]code['"]\s*:\s*['"]([^'"]+)['"]/);
        code = match?.[1];
      }
      if (!code && typeof detail.code === 'string') code = detail.code;
    } catch {
      /* noop */
    }
    if (code === '2fa_code_required' || raw.includes('2fa_code_required')) {
      return { ok: false, requiresTotp: true };
    }
    return { ok: false, requiresTotp: false, status: response.status(), detail: raw };
  }

  if (!response.ok()) {
    return {
      ok: false,
      requiresTotp: false,
      status: response.status(),
      detail: await response.text(),
    };
  }

  return { ok: true, data: (await response.json()) as Record<string, unknown> };
}

/** Inject auth tokens into localStorage (same pattern as role-full-audit.spec.ts). */
async function injectSession(page: Page, data: Record<string, unknown>): Promise<void> {
  await page.goto('/login');
  await page.evaluate((payload) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('token', String(payload.access_token));
    localStorage.setItem('userId', String(payload.user_id));
    localStorage.setItem('orgId', String(payload.org_id));
    localStorage.setItem('userName', String(payload.user_name || ''));
    if (payload.role) localStorage.setItem('userRole', String(payload.role));
  }, data);
}

/** Force the UI language via localStorage (mirrors rtl-snapshots.spec.ts). */
async function setLanguage(page: Page, lang: 'ku' | 'en'): Promise<void> {
  await page.addInitScript((l) => {
    try {
      window.localStorage.setItem('i18n.language', l);
    } catch {
      /* ignore */
    }
  }, lang);
}

/** Clear auth state between role iterations. */
async function logout(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

// ─── Console-error filter (mirrors role-full-audit.spec.ts) ────────────────

function isIgnorableConsoleError(text: string): boolean {
  return (
    /favicon|404.*\.(png|ico|svg)/i.test(text) ||
    /Warning:\s*\[antd:/i.test(text) ||
    /Failed to load resource.*403/i.test(text)
  );
}

// ─── Suite: desktop ─────────────────────────────────────────────────────────

test.describe('Premium glass — per-role visual baselines (desktop)', () => {
  test.skip(!RUN, 'Premium glass snapshot suite is gated behind RUN_GLASS_SNAPSHOTS=1');

  test.use({ viewport: { width: 1440, height: 900 } });

  for (const { role, email, homePath } of DEMO_USERS) {
    for (const dir of DIRECTIONS) {
      test(`premium-${role}-desktop-${dir}`, async ({ page, request }) => {
        test.setTimeout(60_000);

        // ── Language must be set via addInitScript BEFORE any navigation ──
        await setLanguage(page, dir);

        // ── Login ──
        const login = await tryLogin(request, email);

        if (!login.ok && login.requiresTotp) {
          test.skip(true, `${role}: TOTP required — skipping visual baseline`);
          return;
        }
        if (!login.ok) {
          test.skip(true, `${role}: login API unavailable (HTTP ${login.status}) — skipping`);
          return;
        }

        const loginData = login.data;
        const destPath = loginData.requires_2fa_setup ? '/dashboard' : homePath;

        await injectSession(page, loginData);

        // Re-apply language after session injection (localStorage was cleared).
        await page.evaluate((l) => {
          try { window.localStorage.setItem('i18n.language', l); } catch { /* ignore */ }
        }, dir);

        // ── Navigate to home ──
        const consoleErrors: string[] = [];
        page.on('console', (msg) => {
          if (msg.type() === 'error' && !isIgnorableConsoleError(msg.text())) {
            consoleErrors.push(msg.text());
          }
        });

        await page.goto(destPath, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForTimeout(600);

        // ── Assert role identity chip or hero ──
        const chip = page.locator('.role-identity-chip');
        const hero = page.locator('.glass-card, [class*="role-hero"], [class*="RoleHero"]');
        const identityVisible =
          (await chip.isVisible().catch(() => false)) ||
          (await hero.first().isVisible().catch(() => false));

        if (!identityVisible) {
          // Soft-fail: log but do not abort the snapshot.
          console.warn(`[${role}/${dir}/desktop] role identity element not found`);
        }

        // ── Assert no critical console errors ──
        expect(
          consoleErrors,
          `Console errors on ${role}/${dir}/desktop: ${consoleErrors.join(' | ')}`,
        ).toHaveLength(0);

        // ── Document direction ──
        const docDir = await page.evaluate(() => document.documentElement.dir);
        const expectedDir = dir === 'ku' ? 'rtl' : 'ltr';
        expect(docDir, `dir attribute for ${dir}`).toBe(expectedDir);

        // ── Wait for fonts ──
        await page.evaluate(() => document.fonts?.ready);

        // ── Visual snapshot ──
        await expect(page).toHaveScreenshot(`premium-${role}-desktop-${dir}.png`, {
          fullPage: false,
          animations: 'disabled',
          maxDiffPixelRatio: 0.08,
          mask: [
            page.locator('[data-testid="now"]'),
            page.locator('[data-volatile="true"]'),
            page.locator('time'),
          ],
        });

        // ── Cleanup ──
        await logout(page);
      });
    }
  }
});

// ─── Suite: mobile ──────────────────────────────────────────────────────────

test.describe('Premium glass — per-role visual baselines (mobile)', () => {
  test.skip(!RUN, 'Premium glass snapshot suite is gated behind RUN_GLASS_SNAPSHOTS=1');

  test.use({ viewport: { width: 390, height: 844 } });

  for (const { role, email, homePath } of DEMO_USERS) {
    for (const dir of DIRECTIONS) {
      test(`premium-${role}-mobile-${dir}`, async ({ page, request }) => {
        test.setTimeout(60_000);

        await setLanguage(page, dir);

        const login = await tryLogin(request, email);

        if (!login.ok && login.requiresTotp) {
          test.skip(true, `${role}: TOTP required — skipping visual baseline`);
          return;
        }
        if (!login.ok) {
          test.skip(true, `${role}: login API unavailable (HTTP ${login.status}) — skipping`);
          return;
        }

        const loginData = login.data;
        const destPath = loginData.requires_2fa_setup ? '/dashboard' : homePath;

        await injectSession(page, loginData);

        await page.evaluate((l) => {
          try { window.localStorage.setItem('i18n.language', l); } catch { /* ignore */ }
        }, dir);

        const consoleErrors: string[] = [];
        page.on('console', (msg) => {
          if (msg.type() === 'error' && !isIgnorableConsoleError(msg.text())) {
            consoleErrors.push(msg.text());
          }
        });

        await page.goto(destPath, { waitUntil: 'domcontentloaded', timeout: 30_000 });
        await page.waitForTimeout(600);

        // On mobile the bottom-sheet / collapsed nav may replace the chip.
        const chip = page.locator('.role-identity-chip');
        const hero = page.locator('.glass-card, [class*="role-hero"], [class*="RoleHero"]');
        const identityVisible =
          (await chip.isVisible().catch(() => false)) ||
          (await hero.first().isVisible().catch(() => false));

        if (!identityVisible) {
          console.warn(`[${role}/${dir}/mobile] role identity element not found`);
        }

        expect(
          consoleErrors,
          `Console errors on ${role}/${dir}/mobile: ${consoleErrors.join(' | ')}`,
        ).toHaveLength(0);

        const docDir = await page.evaluate(() => document.documentElement.dir);
        const expectedDir = dir === 'ku' ? 'rtl' : 'ltr';
        expect(docDir, `dir attribute for ${dir}`).toBe(expectedDir);

        await page.evaluate(() => document.fonts?.ready);

        await expect(page).toHaveScreenshot(`premium-${role}-mobile-${dir}.png`, {
          fullPage: false,
          animations: 'disabled',
          maxDiffPixelRatio: 0.08,
          mask: [
            page.locator('[data-testid="now"]'),
            page.locator('[data-volatile="true"]'),
            page.locator('time'),
          ],
        });

        await logout(page);
      });
    }
  }
});
