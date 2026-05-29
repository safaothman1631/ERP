import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SETUP_LEAVES,
  ROLE_SETUP_VISIBLE,
  getExpectedNavSections,
} from '../src/audit/roleAuditMatrix';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORTS_DIR = path.join(__dirname, 'reports');

const DEMO_PASSWORD = 'Demo@2026';
const API_BASE = process.env.PLAYWRIGHT_API_URL || 'http://127.0.0.1:8000';

/** Owner/admin require TOTP when 2FA is already enabled — skip browser audit. */
const SKIP_ON_2FA_CODE = new Set(['owner', 'admin']);

const DEMO_USERS: { role: string; email: string; homePath: string }[] = [
  { role: 'owner', email: 'demo-owner@zohoerp.example.com', homePath: '/dashboard' },
  { role: 'admin', email: 'demo-admin@zohoerp.example.com', homePath: '/dashboard' },
  { role: 'manager', email: 'demo-manager@zohoerp.example.com', homePath: '/dashboard' },
  { role: 'accountant', email: 'demo-accountant@zohoerp.example.com', homePath: '/dashboard' },
  { role: 'sales_rep', email: 'demo-sales@zohoerp.example.com', homePath: '/crm/leads' },
  { role: 'purchaser', email: 'demo-purchaser@zohoerp.example.com', homePath: '/purchase-orders' },
  { role: 'inventory_manager', email: 'demo-inventory@zohoerp.example.com', homePath: '/inventory' },
  { role: 'cashier', email: 'demo-cashier@zohoerp.example.com', homePath: '/pos' },
  { role: 'hr', email: 'demo-hr@zohoerp.example.com', homePath: '/hr' },
  { role: 'project_manager', email: 'demo-projects@zohoerp.example.com', homePath: '/projects' },
  { role: 'viewer', email: 'demo-viewer@zohoerp.example.com', homePath: '/dashboard' },
  { role: 'user', email: 'demo-user@zohoerp.example.com', homePath: '/dashboard' },
];

type SetupLeafVisit = { path: string; status: number | null };

type RoleAuditResult = {
  role: string;
  email: string;
  status: 'pass' | 'fail' | 'skipped';
  skipReason?: string;
  is2faEnabled?: boolean;
  pagesVisited: string[];
  pagesCrashed: string[];
  consoleErrors: string[];
  failedRequests: { url: string; status: number; method: string }[];
  chipVisible: boolean | null;
  navSectionKeys: string[];
  navSectionLabels: string[];
  expectedNavSections: string[];
  navSectionMismatches: string[];
  setupLeavesVisited: SetupLeafVisit[];
  settingsTabsVisited: string[];
  topBarSmoke: {
    densityMenuVisible: boolean;
    userMenuItems: string[];
  } | null;
  failures: string[];
};

const auditResults: RoleAuditResult[] = [];

function shouldIgnoreRequest(url: string): boolean {
  return (
    url.includes('/api/auth/login') ||
    url.endsWith('.map') ||
    url.includes('favicon') ||
    url.includes('chrome-extension')
  );
}

function attachMonitors(page: Page, bucket: RoleAuditResult) {
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/favicon|404.*\.(png|ico|svg)/i.test(text)) return;
    if (/Warning:\s*\[antd:/i.test(text)) return;
    if (/Failed to load resource.*403/i.test(text)) return;
    bucket.consoleErrors.push(text);
  });

  page.on('pageerror', (err) => {
    bucket.pagesCrashed.push(`${page.url()} — ${err.message}`);
  });

  page.on('response', (response) => {
    const status = response.status();
    if (status < 400) return;
    const url = response.url();
    if (shouldIgnoreRequest(url)) return;
    bucket.failedRequests.push({
      url,
      status,
      method: response.request().method(),
    });
  });
}

async function tryLogin(
  request: APIRequestContext,
  email: string,
): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; requiresTotp: true }
  | { ok: false; requiresTotp: false; status: number; detail: string }
> {
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
    return {
      ok: false,
      requiresTotp: false,
      status: response.status(),
      detail: raw,
    };
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

async function injectSession(page: Page, data: Record<string, unknown>) {
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

async function visitPage(page: Page, path: string, bucket: RoleAuditResult) {
  const target = path.startsWith('/') ? path : `/${path}`;
  bucket.pagesVisited.push(target);
  const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  if (response && response.status() >= 400) {
    bucket.failedRequests.push({
      url: response.url(),
      status: response.status(),
      method: 'GET',
    });
  }
  await page.waitForTimeout(800);
}

async function visitSetupLeaf(page: Page, route: string, bucket: RoleAuditResult) {
  const target = route.startsWith('/') ? route : `/${route}`;
  bucket.pagesVisited.push(target);
  const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  const status = response?.status() ?? null;
  bucket.setupLeavesVisited.push({ path: target, status });
  console.log(`  [${bucket.role}] setup leaf ${target} → HTTP ${status ?? 'n/a'}`);
  await page.waitForTimeout(400);
}

async function dismissOverlays(page: Page) {
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
  const backdrop = page.locator('[role="presentation"]._backdrop_mijie_5, .ant-modal-wrap, .ant-drawer-mask').first();
  if (await backdrop.isVisible().catch(() => false)) {
    await backdrop.click({ force: true, timeout: 2000 }).catch(() => undefined);
    await page.waitForTimeout(300);
  }
}

async function collectVisibleNavSections(page: Page): Promise<{ keys: string[]; labels: string[] }> {
  await dismissOverlays(page);
  const toggles = page.locator('button.sn3-section-toggle');
  const count = await toggles.count();
  const keys: string[] = [];
  const labels: string[] = [];

  for (let i = 0; i < count; i++) {
    const toggle = toggles.nth(i);
    if (!(await toggle.isVisible().catch(() => false))) continue;
    const label = (await toggle.getAttribute('aria-label')) || '';
    const controls = (await toggle.getAttribute('aria-controls')) || '';
    const key = controls.replace(/^sn3-section-/, '');
    if (key) keys.push(key);
    if (label) labels.push(label);
  }

  return { keys, labels };
}

function compareNavSections(
  role: string,
  visibleKeys: string[],
  expectedKeys: string[],
): string[] {
  const visible = new Set(visibleKeys);
  const expected = new Set(expectedKeys);
  const mismatches: string[] = [];

  for (const key of expected) {
    if (!visible.has(key)) {
      mismatches.push(`missing expected section: ${key}`);
    }
  }
  for (const key of visible) {
    if (!expected.has(key)) {
      mismatches.push(`unexpected section visible: ${key}`);
    }
  }

  if (mismatches.length) {
    console.log(`  [${role}] nav section mismatches (soft): ${mismatches.join('; ')}`);
  }
  return mismatches;
}

async function collectSettingsTabKeys(page: Page): Promise<string[]> {
  await page.goto('/settings', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(600);
  await dismissOverlays(page);

  const tabButtons = page.locator('.st-aside-nav .st-group .st-nav-item');
  const count = await tabButtons.count();
  const keys: string[] = [];

  for (let i = 0; i < count && keys.length < 5; i++) {
    const item = tabButtons.nth(i);
    if (!(await item.isVisible().catch(() => false))) continue;

    const isExternal = (await item.locator('.st-nav-arrow').count()) > 0;
    if (isExternal) continue;

    await item.click({ timeout: 8000 }).catch(() => undefined);
    await page.waitForTimeout(500);

    const url = new URL(page.url());
    const sectionKey = url.searchParams.get('s');
    if (sectionKey && !keys.includes(sectionKey)) {
      keys.push(sectionKey);
    }
  }

  return keys;
}

async function visitSettingsTabs(page: Page, tabKeys: string[], bucket: RoleAuditResult) {
  for (const key of tabKeys.slice(0, 5)) {
    const target = `/settings?s=${key}`;
    bucket.pagesVisited.push(target);
    bucket.settingsTabsVisited.push(key);
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(400);
  }
}

async function smokeTopBar(page: Page, bucket: RoleAuditResult) {
  await dismissOverlays(page);

  const densityBtn = page.getByRole('button', { name: /density|چڕایی|الكثافة/i });
  let densityMenuVisible = false;
  if (await densityBtn.isVisible().catch(() => false)) {
    await densityBtn.click({ timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(300);
    const menuItems = page.locator('.ant-dropdown-menu-item');
    densityMenuVisible = (await menuItems.count()) >= 3;
    await page.keyboard.press('Escape');
  }

  const userMenuBtn = page.getByRole('button', { name: /user menu|مێنیوی بەکارهێنەر|قائمة المستخدم/i });
  const userMenuItems: string[] = [];
  if (await userMenuBtn.isVisible().catch(() => false)) {
    await userMenuBtn.click({ timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(300);
    const items = page.locator('.ant-dropdown-menu-item');
    const itemCount = await items.count();
    for (let i = 0; i < itemCount; i++) {
      const text = (await items.nth(i).innerText()).trim();
      if (text) userMenuItems.push(text);
    }
    await page.keyboard.press('Escape');
  }

  bucket.topBarSmoke = { densityMenuVisible, userMenuItems };

  const menuText = userMenuItems.join(' ').toLowerCase();
  const hasProfile = /profile|پرۆفایل|الملف/i.test(menuText);
  const hasSettings = /settings|ڕێکخستن|الإعدادات/i.test(menuText);
  const hasLogout = /logout|چوونەدەر|تسجيل/i.test(menuText);

  if (!densityMenuVisible) {
    bucket.failures.push('TopBar density dropdown did not show menu items');
  }
  if (!hasProfile || !hasSettings || !hasLogout) {
    bucket.failures.push(
      `User menu missing items (profile=${hasProfile}, settings=${hasSettings}, logout=${hasLogout})`,
    );
  }
}

async function checkMe2fa(
  request: APIRequestContext,
  token: string,
): Promise<boolean | undefined> {
  const me = await request.get(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!me.ok()) return undefined;
  const body = (await me.json()) as { is_2fa_enabled?: boolean };
  return Boolean(body.is_2fa_enabled);
}

async function logout(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

test.describe('Role full browser audit — 12 demo roles', () => {
  for (const user of DEMO_USERS) {
    test(`audit: ${user.role} (${user.email})`, async ({ page, request }) => {
      test.setTimeout(180_000);

      const expectedNavSections = getExpectedNavSections(user.role);

      const bucket: RoleAuditResult = {
        role: user.role,
        email: user.email,
        status: 'pass',
        pagesVisited: [],
        pagesCrashed: [],
        consoleErrors: [],
        failedRequests: [],
        chipVisible: null,
        navSectionKeys: [],
        navSectionLabels: [],
        expectedNavSections,
        navSectionMismatches: [],
        setupLeavesVisited: [],
        settingsTabsVisited: [],
        topBarSmoke: null,
        failures: [],
      };

      attachMonitors(page, bucket);

      const login = await tryLogin(request, user.email);

      if (!login.ok && login.requiresTotp) {
        bucket.status = 'skipped';
        bucket.skipReason = 'Login requires TOTP (2fa_code_required); is_2fa_enabled=true (inferred)';
        bucket.is2faEnabled = true;
        auditResults.push(bucket);
        if (SKIP_ON_2FA_CODE.has(user.role)) {
          test.skip(true, `${user.role}: skipped — TOTP required (is_2fa_enabled inferred true)`);
          return;
        }
        bucket.status = 'fail';
        bucket.failures.push('Unexpected 2FA requirement for non-privileged role');
        auditResults[auditResults.length - 1] = bucket;
        expect(false, bucket.failures[0]).toBeTruthy();
        return;
      }

      if (!login.ok) {
        bucket.status = 'fail';
        bucket.failures.push(`Login failed: HTTP ${login.status} — ${login.detail}`);
        auditResults.push(bucket);
        expect(login.ok, bucket.failures.join('; ')).toBeTruthy();
        return;
      }

      const loginData = login.data;
      if (loginData.access_token) {
        bucket.is2faEnabled = await checkMe2fa(request, String(loginData.access_token));
      }

      const destPath = loginData.requires_2fa_setup ? '/settings?s=security' : user.homePath;
      await injectSession(page, loginData);
      await visitPage(page, destPath, bucket);

      const navSections = await collectVisibleNavSections(page);
      bucket.navSectionKeys = navSections.keys;
      bucket.navSectionLabels = navSections.labels;
      bucket.navSectionMismatches = compareNavSections(
        user.role,
        navSections.keys,
        expectedNavSections,
      );

      if (ROLE_SETUP_VISIBLE[user.role]) {
        for (const leaf of SETUP_LEAVES) {
          await visitSetupLeaf(page, leaf, bucket);
        }
      }

      const settingsTabKeys = await collectSettingsTabKeys(page);
      await visitSettingsTabs(page, settingsTabKeys, bucket);

      await smokeTopBar(page, bucket);

      const chip = page.locator('.role-identity-chip');
      bucket.chipVisible = await chip.isVisible().catch(() => false);
      if (!bucket.chipVisible) {
        bucket.failures.push('role-identity-chip not visible');
      }

      await logout(page);

      if (bucket.pagesCrashed.length > 0) {
        bucket.failures.push(`page crash: ${bucket.pagesCrashed.join(' | ')}`);
      }

      const serverErrors = bucket.failedRequests.filter(
        (r) => r.url.includes('/api/') && r.status >= 500,
      );
      if (serverErrors.length > 0) {
        bucket.failures.push(`${serverErrors.length} API 5xx response(s)`);
      }

      if (bucket.failures.length > 0) {
        bucket.status = 'fail';
      }

      auditResults.push(bucket);

      expect(bucket.pagesCrashed, `crashes on ${user.role}`).toHaveLength(0);
      expect(bucket.chipVisible, `chip visible for ${user.role}`).toBe(true);
      expect(
        serverErrors.map((r) => `${r.method} ${r.status} ${r.url}`).join('\n') || '',
        `5xx for ${user.role}`,
      ).toBe('');
    });
  }

  test.afterAll(async () => {
    console.log('\n========== ROLE FULL AUDIT SUMMARY ==========\n');

    console.log('| Role | Status | Chip | Pages | Nav Δ | Setup | Settings | Notes |');
    console.log('|------|--------|------|-------|-------|-------|----------|-------|');
    for (const r of auditResults) {
      const notes =
        r.skipReason ||
        (r.failures.length ? r.failures.slice(0, 2).join('; ') : 'OK') +
          (r.is2faEnabled !== undefined ? ` 2FA=${r.is2faEnabled}` : '');
      console.log(
        `| ${r.role} | ${r.status.toUpperCase()} | ${r.chipVisible ?? 'n/a'} | ${r.pagesVisited.length} | ${r.navSectionMismatches.length} | ${r.setupLeavesVisited.length} | ${r.settingsTabsVisited.length} | ${notes} |`,
      );
    }

    const allFailedRequests = auditResults.flatMap((r) =>
      r.failedRequests
        .filter((req) => req.url.includes('/api/'))
        .map((req) => ({ role: r.role, ...req })),
    );
    if (allFailedRequests.length) {
      console.log('\n--- Failed network requests (4xx/5xx) ---');
      for (const req of allFailedRequests) {
        console.log(`  [${req.role}] ${req.method} ${req.status} ${req.url}`);
      }
    }

    const allConsoleErrors = auditResults.flatMap((r) =>
      r.consoleErrors.map((msg) => ({ role: r.role, msg })),
    );
    if (allConsoleErrors.length) {
      console.log('\n--- Console errors ---');
      for (const e of allConsoleErrors) {
        console.log(`  [${e.role}] ${e.msg}`);
      }
    }

    const crashed = auditResults.filter((r) => r.pagesCrashed.length > 0);
    if (crashed.length) {
      console.log('\n--- Page crashes ---');
      for (const r of crashed) {
        for (const c of r.pagesCrashed) {
          console.log(`  [${r.role}] ${c}`);
        }
      }
    }

    const skipped2fa = auditResults.filter((r) => r.status === 'skipped');
    if (skipped2fa.length) {
      console.log('\n--- Skipped (2FA / TOTP) ---');
      for (const r of skipped2fa) {
        console.log(`  [${r.role}] ${r.skipReason}`);
      }
    }

    console.log('\n=============================================\n');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(REPORTS_DIR, `role-audit-${timestamp}.json`);
    fs.mkdirSync(REPORTS_DIR, { recursive: true });

    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        total: auditResults.length,
        pass: auditResults.filter((r) => r.status === 'pass').length,
        fail: auditResults.filter((r) => r.status === 'fail').length,
        skipped: auditResults.filter((r) => r.status === 'skipped').length,
        skipped2faRoles: skipped2fa.map((r) => r.role),
      },
      roles: auditResults,
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`JSON report written: ${reportPath}`);
  });
});
