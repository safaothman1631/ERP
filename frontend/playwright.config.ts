import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — Sprint 10 — smoke E2E + a11y axe scans.
 * Run: npm run e2e
 * Pre-req: dev server must already be running on http://localhost:5173
 *
 * Kurdish / RTL configuration (Requirement 9.5):
 * - locale: "ku-IQ"  — Kurdish (Iraq) locale; tells the browser to use
 *   Kurdish date/number formatting and Accept-Language headers, which
 *   triggers the app's i18n system to load Kurdish translations and set
 *   document.documentElement.dir = "rtl" automatically.
 * - timezoneId: "Asia/Baghdad" — matches the primary deployment region.
 * - The RTL direction itself is applied by the app (see src/i18n.ts and
 *   the "document direction is RTL by default (ku)" test in
 *   e2e/04-shortcuts-rtl.spec.ts). Playwright inherits the RTL layout
 *   from the running page, so screenshots and visual assertions reflect
 *   the correct right-to-left rendering.
 */

/** Kurdish Iraq locale used across all e2e projects. */
const KU_IQ_LOCALE = 'ku-IQ';

/** Baghdad timezone — matches the primary deployment region. */
const BAGHDAD_TZ = 'Asia/Baghdad';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // ── Kurdish / RTL settings ──────────────────────────────────────────
    // locale triggers the app's i18n to activate Kurdish and set dir=rtl.
    locale: KU_IQ_LOCALE,
    // timezoneId ensures date/time assertions match the Iraqi timezone.
    timezoneId: BAGHDAD_TZ,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
