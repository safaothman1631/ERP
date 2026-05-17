import { defineConfig, devices } from '@playwright/test';

/**
 * Dedicated Playwright config for the navigation-404-fix runtime sweep.
 *
 * Why a dedicated config?
 * The repo's main config (`frontend/playwright.config.ts`) targets `./e2e`
 * with `workers: 1` and `fullyParallel: false` because some smoke specs
 * write to shared state. The sweep authored under `frontend/tests/e2e/`
 * walks ~300+ static destinations across seven surfaces and is safe to
 * shard, so it gets its own config with `fullyParallel: true` and
 * `workers: 4` (Task 3.5 requirement).
 *
 * The auth fixture lives at `frontend/e2e/helpers/auth.ts` and is
 * imported from this directory via `../../e2e/helpers/auth.ts`. The
 * `loginAsAdmin` helper signs in as a regular tenant user (admin@test.com
 * is a tenant admin, NOT a super-admin) so the standard authenticated app
 * shell loads.
 *
 * Pre-req: a running frontend (e.g. `npm run dev` at :5173 or `vite preview`)
 * and a backend reachable at API_BASE_URL. CI wires both up via
 * `.github/workflows/ci-quality.yml`.
 *
 * Run:
 *   npx playwright test --config frontend/tests/e2e/playwright.config.ts
 *   # or via the workspace script:
 *   npm --prefix frontend run nav:sweep
 */
export default defineConfig({
  testDir: '.',
  testMatch: ['nav-sweep.spec.ts', 'nav-sweep.exploration.spec.ts'],
  timeout: 60_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : 4,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: '../../playwright-report-nav-sweep' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'ku-IQ',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
