/**
 * Shared `fast-check` arbitraries for system-wide-ux-overhaul property tests.
 *
 * Used by `frontend/src/system-wide-ux-overhaul.pbt.test.ts` for properties
 * that span the route × viewport × locale matrix (P5, P6, P7, P8, P9).
 *
 * The generators here describe the input space for the responsive invariant
 * documented in `.kiro/specs/system-wide-ux-overhaul/design.md` →
 * "Correctness Properties" → Property 5.
 */

import * as fc from 'fast-check';

// ─────────────────────────────────────────────────────────────────────────────
// Viewport arbitrary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The three representative viewport widths used in the responsive invariant
 * property tests. These correspond to:
 *   - 320: Mobile_Viewport (smallest supported width per R2.1)
 *   - 768: Tablet_Viewport (md breakpoint)
 *   - 1280: Desktop_Viewport (xl breakpoint)
 */
export const VIEWPORT_WIDTHS = [320, 768, 1280] as const;
export type ViewportWidth = (typeof VIEWPORT_WIDTHS)[number];

export const viewportWidthArb: fc.Arbitrary<ViewportWidth> =
  fc.constantFrom<ViewportWidth>(...VIEWPORT_WIDTHS);

// ─────────────────────────────────────────────────────────────────────────────
// Locale arbitrary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The two supported locales. `en` is LTR, `ku` is RTL.
 */
export const LOCALES = ['en', 'ku'] as const;
export type Locale = (typeof LOCALES)[number];

export const localeArb: fc.Arbitrary<Locale> =
  fc.constantFrom<Locale>(...LOCALES);

// ─────────────────────────────────────────────────────────────────────────────
// Route arbitrary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A representative subset of application routes for property testing.
 *
 * These are static routes (no dynamic `:param` segments) that can be
 * rendered without specific data dependencies. The list covers public,
 * authenticated, and various module routes to ensure broad coverage.
 *
 * Routes with dynamic params (e.g., `/invoices/:id/edit`) are excluded
 * because they require specific data to render meaningfully.
 */
export const APP_ROUTES = [
  // Public routes
  '/landing',
  '/login',
  '/signup',
  '/forgot-password',
  // Authenticated routes — core
  '/dashboard',
  '/contacts',
  '/items',
  '/invoices',
  '/expenses',
  '/accounts',
  '/reports',
  '/settings',
  // Sales
  '/quotes',
  '/sales-orders',
  '/credit-notes',
  '/recurring-invoices',
  // Purchases
  '/bills',
  '/purchase-orders',
  '/vendor-credits',
  // Banking
  '/banking',
  '/journals',
  // Inventory
  '/inventory',
  // HR
  '/hr',
  '/hr/employees',
  '/hr/attendance',
  '/hr/time-off',
  // CRM
  '/crm/leads',
  '/crm/pipeline',
  // Manufacturing
  '/manufacturing/boms',
  '/manufacturing/orders',
  // POS
  '/pos',
  // Marketing
  '/marketing',
  // Projects
  '/projects',
  // Settings & Admin
  '/tax-settings',
  '/users',
  '/branches',
  '/audit-log',
  '/trash',
] as const;

export type AppRoute = (typeof APP_ROUTES)[number];

export const routeArb: fc.Arbitrary<AppRoute> =
  fc.constantFrom<AppRoute>(...APP_ROUTES);

// ─────────────────────────────────────────────────────────────────────────────
// Combined triple arbitrary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A `(route, viewport, locale)` triple for the responsive invariant tests.
 */
export interface ResponsiveTriple {
  route: AppRoute;
  viewport: ViewportWidth;
  locale: Locale;
}

export const responsiveTripleArb: fc.Arbitrary<ResponsiveTriple> = fc.record({
  route: routeArb,
  viewport: viewportWidthArb,
  locale: localeArb,
});
