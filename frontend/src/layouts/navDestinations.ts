/**
 * navDestinations — single-source-of-truth registry of every static
 * (non-parameterized) navigation destination clickable from the seven
 * authenticated nav surfaces. Consumed by:
 *
 *   - `frontend/scripts/nav-audit.mjs` for the router-semantic match pass
 *     (Requirement 2.6, 2.7).
 *   - `frontend/tests/e2e/nav-sweep.spec.ts` for the runtime sweep
 *     (Requirement 2.1 – 2.5).
 *
 * This module MUST remain pure data. Do NOT import React, JSX, page
 * components, or any module that pulls in the runtime UI tree — the audit
 * loads this file directly under Node and would fail on those imports.
 *
 * Invariants enforced at import time:
 *   - every `path` starts with '/'
 *   - no `path` contains ':' (parameterized segments are excluded by spec)
 *   - no `path` contains '*' (catch-all is excluded by spec)
 *   - the registry contains at least one entry for each declared surface
 *     so nothing is silently dropped during refactor
 */

export type NavSurface =
  | 'side_nav_leaf'
  | 'quick_create_item'
  | 'top_bar_menu_item'
  | 'command_palette_command'
  | 'in_page_link'
  | 'breadcrumb_segment'
  | 'module_hub_tile';

export interface NavDestination {
  /** Which UI surface this destination is reachable from. */
  surface: NavSurface;
  /** Human-readable origin for diagnostics, e.g. "TopBar.userMenu". */
  source: string;
  /** Static URL path. Must start with '/'; no ':' segments; no '*'. */
  path: string;
}

// -----------------------------------------------------------------------------
// Side-nav leaves
// Mirrors the static keys from `buildNavSections(t)` in `navigation.tsx`.
// Keep this list in sync with navigation.tsx; the audit's router-semantic
// pass will catch any drift between this list and the route tree.
// -----------------------------------------------------------------------------
const SIDE_NAV_LEAVES: ReadonlyArray<readonly [section: string, path: string]> = [
  // overview
  ['overview', '/'],
  ['overview', '/contacts'],
  ['overview', '/items'],
  // sales
  ['sales', '/invoices'],
  ['sales', '/quotes'],
  ['sales', '/sales-orders'],
  ['sales', '/credit-notes'],
  ['sales', '/shipments'],
  ['sales', '/delivery-challans'],
  ['sales', '/sales-returns'],
  ['sales', '/returns/sales'],
  ['sales', '/payment-links'],
  ['sales', '/recurring-invoices'],
  // purchases
  ['purchases', '/bills'],
  ['purchases', '/purchase-orders'],
  ['purchases', '/vendor-credits'],
  ['purchases', '/purchase-returns'],
  ['purchases', '/returns/vendor'],
  ['purchases', '/expenses'],
  ['purchases', '/expense-claims'],
  // banking
  ['banking', '/banking'],
  ['banking', '/banking/rules'],
  ['banking', '/banking/reconciliation'],
  // inventory
  ['inventory', '/inventory'],
  ['inventory', '/inventory/warehouses'],
  ['inventory', '/inventory/locations'],
  ['inventory', '/inventory/putaway-rules'],
  ['inventory', '/inventory/cycle-counts'],
  ['inventory', '/inventory/price-lists'],
  ['inventory', '/inventory/serials'],
  // manufacturing
  ['manufacturing', '/manufacturing/boms'],
  ['manufacturing', '/manufacturing/orders'],
  ['manufacturing', '/manufacturing/work-centers'],
  // wms
  ['wms', '/wms'],
  // tms
  ['tms', '/tms'],
  // quality
  ['quality', '/quality'],
  ['quality', '/quality/plans'],
  ['quality', '/quality/checks'],
  ['quality', '/quality/ncr'],
  ['quality', '/quality/capa'],
  // pos
  ['pos', '/pos'],
  ['pos', '/pos/sessions'],
  ['pos', '/pos/orders'],
  ['pos', '/pos/configs'],
  ['pos', '/pos/categories'],
  ['pos', '/pos/products'],
  ['pos', '/pos/pricelists'],
  ['pos', '/pos/employees'],
  ['pos', '/pos/loyalty'],
  ['pos', '/pos/gift-cards'],
  ['pos', '/pos/floors'],
  ['pos', '/pos/reports'],
  // hotel
  ['hotel', '/hotel'],
  ['hotel', '/hotel/rooms'],
  // restaurant
  ['restaurant', '/restaurant/tables'],
  ['restaurant', '/restaurant/kds'],
  ['restaurant', '/restaurant/menu'],
  // field-service
  ['field-service', '/field-service'],
  ['field-service', '/field-service/orders'],
  ['field-service', '/field-service/technicians'],
  ['field-service', '/field-service/dispatch'],
  // crm
  ['crm', '/crm/leads'],
  ['crm', '/crm/pipeline'],
  ['crm', '/crm/activities'],
  ['crm', '/crm/insights'],
  // marketing
  ['marketing', '/marketing'],
  ['marketing', '/marketing/campaigns/email'],
  ['marketing', '/marketing/campaigns/sms'],
  ['marketing', '/marketing/segments'],
  ['marketing', '/marketing/automations'],
  // hr
  ['hr', '/hr'],
  ['hr', '/hr/employees'],
  ['hr', '/hr/contracts'],
  ['hr', '/hr/attendance'],
  ['hr', '/hr/time-off'],
  ['hr', '/payroll/rules'],
  ['hr', '/payroll/runs'],
  ['hr', '/mileage'],
  ['hr', '/mileage/rates'],
  // projects
  ['projects', '/projects'],
  ['projects', '/assets'],
  // accounting
  ['accounting', '/accounts'],
  ['accounting', '/journals'],
  ['accounting', '/reports'],
  ['accounting', '/reports/advanced'],
  ['accounting', '/reports/scheduled'],
  ['accounting', '/reports/custom-list'],
  ['accounting', '/tax-settings'],
  ['accounting', '/tax-returns'],
  // reports-mgt
  ['reports-mgt', '/companies'],
  ['reports-mgt', '/branches'],
  ['reports-mgt', '/reports/branches'],
  ['reports-mgt', '/reports/consolidated'],
  ['reports-mgt', '/approvals'],
  ['reports-mgt', '/audit-log'],
  // multi-entity
  ['multi-entity', '/multi-entity/companies'],
  ['multi-entity', '/multi-entity/intercompany'],
  ['multi-entity', '/multi-entity/consolidated-pl'],
  ['multi-entity', '/multi-entity/consolidated-bs'],
  ['multi-entity', '/multi-entity/eliminations'],
  // mdm
  ['mdm', '/mdm'],
  // bpmn
  ['bpmn', '/bpmn'],
  // iraq-int
  ['iraq-int', '/l10n-iq'],
  ['iraq-int', '/einvoice/dashboard'],
  ['iraq-int', '/whatsapp'],
  ['iraq-int', '/ocr/receipts'],
  // ext-engagement
  ['ext-engagement', '/activities/my'],
  ['ext-engagement', '/activities'],
  ['ext-engagement', '/helpdesk'],
  ['ext-engagement', '/helpdesk/tickets'],
  ['ext-engagement', '/helpdesk/settings'],
  ['ext-engagement', '/kb'],
  ['ext-engagement', '/wave-a/helpdesk'],
  ['ext-engagement', '/wave-a/field-service'],
  ['ext-engagement', '/subscriptions'],
  ['ext-engagement', '/subscriptions/plans'],
  ['ext-engagement', '/subscriptions/dunning'],
  ['ext-engagement', '/subscriptions/reports'],
  ['ext-engagement', '/wave-a/documents'],
  ['ext-engagement', '/dms'],
  ['ext-engagement', '/dms/signatures'],
  ['ext-engagement', '/wave-a/knowledge'],
  ['ext-engagement', '/wave-a/hr-extended'],
  // ext-ops
  ['ext-ops', '/wave-a/quality'],
  ['ext-ops', '/maintenance'],
  ['ext-ops', '/maintenance/equipment'],
  ['ext-ops', '/maintenance/requests'],
  ['ext-ops', '/maintenance/schedules'],
  ['ext-ops', '/maintenance/categories'],
  ['ext-ops', '/wave-a/plm'],
  // rental
  ['rental', '/rental/products'],
  ['rental', '/rental/contracts'],
  // repairs
  ['repairs', '/repairs/orders'],
  ['repairs', '/repairs/warranty-check'],
  // admin-config
  ['admin-config', '/settings'],
  ['admin-config', '/settings/numbering'],
  ['admin-config', '/automation-rules'],
  ['admin-config', '/audit-log-viewer'],
  ['admin-config', '/admin/job-runs'],
  ['admin-config', '/studio'],
  // ai-assist
  ['ai-assist', '/ai'],
  ['ai-assist', '/ai/anomalies'],
  ['ai-assist', '/ai/suggestions'],
  ['ai-assist', '/ai/ocr'],
  ['ai-assist', '/ai/predictions'],
  // ext-vertical
  ['ext-vertical', '/healthcare'],
  ['ext-vertical', '/healthcare/patients'],
  ['ext-vertical', '/healthcare/appointments'],
  ['ext-vertical', '/hospital/wards'],
  ['ext-vertical', '/pharmacy/dispense'],
  // setup
  ['setup', '/custom-fields'],
  ['setup', '/users'],
  ['setup', '/rbac-roles'],
  ['setup', '/user-roles'],
  ['setup', '/onboarding'],
  ['setup', '/docs'],
  ['setup', '/ui-gallery'],
  ['setup', '/trash'],
];

// -----------------------------------------------------------------------------
// Quick-create items — mirrors `QUICK_ITEMS` in QuickCreateMenu.tsx
// -----------------------------------------------------------------------------
const QUICK_CREATE_ITEMS: ReadonlyArray<readonly [key: string, path: string]> = [
  ['invoice', '/invoices/new'],
  ['bill', '/bills'],
  ['customer', '/contacts'],
  ['vendor', '/contacts'],
  ['item', '/items'],
  ['quote', '/quotes'],
  ['journal', '/journals'],
];

// -----------------------------------------------------------------------------
// Top-bar menu items — extracted from TopBar.tsx (user menu, org switcher)
// -----------------------------------------------------------------------------
const TOP_BAR_ITEMS: ReadonlyArray<readonly [source: string, path: string]> = [
  ['TopBar.userMenu.settings', '/settings'],
  ['TopBar.userMenu.logout', '/login'],
  ['OrgSwitcher.manage', '/settings'],
];

// -----------------------------------------------------------------------------
// Command-palette commands — every static path produced by `flattenRoutes`
// over `buildNavSections`. These mirror the side-nav leaves but originate
// from a different surface, so they are tracked independently.
// -----------------------------------------------------------------------------
const COMMAND_PALETTE_PATHS: readonly string[] = SIDE_NAV_LEAVES.map(([, p]) => p);

// -----------------------------------------------------------------------------
// In-page CTAs — common static destinations hard-coded in page bodies
// -----------------------------------------------------------------------------
const IN_PAGE_LINKS: ReadonlyArray<readonly [source: string, path: string]> = [
  ['Invoices.newCta', '/invoices/new'],
  ['Items.newCta', '/items/new'],
  ['Quotes.newCta', '/quotes/new'],
  ['KB.newArticleCta', '/kb/articles/new'],
  ['NotFound.goHome', '/'],
];

// -----------------------------------------------------------------------------
// Breadcrumb segments — top-level area roots emitted by Breadcrumb.tsx
// -----------------------------------------------------------------------------
const BREADCRUMB_SEGMENTS: readonly string[] = [
  '/',
  '/contacts',
  '/items',
  '/invoices',
  '/quotes',
  '/sales-orders',
  '/bills',
  '/purchase-orders',
  '/expenses',
  '/banking',
  '/accounts',
  '/journals',
  '/inventory',
  '/projects',
  '/reports',
  '/settings',
];

// -----------------------------------------------------------------------------
// Module-hub tiles — static landing tiles. The dynamic `/ext/:slug` tiles
// are parameterized and excluded by spec.
// -----------------------------------------------------------------------------
const MODULE_HUB_TILES: ReadonlyArray<readonly [slug: string, path: string]> = [
  ['hr', '/hr'],
  ['marketing', '/marketing'],
  ['ai', '/ai'],
  ['maintenance', '/maintenance'],
  ['quality', '/quality'],
  ['hotel', '/hotel'],
  ['healthcare', '/healthcare'],
  ['real-estate', '/real-estate'],
];

// -----------------------------------------------------------------------------
// Composed registry
// -----------------------------------------------------------------------------
const built: NavDestination[] = [
  ...SIDE_NAV_LEAVES.map(
    ([section, path]): NavDestination => ({
      surface: 'side_nav_leaf',
      source: `navigation.${section}`,
      path,
    }),
  ),
  ...QUICK_CREATE_ITEMS.map(
    ([key, path]): NavDestination => ({
      surface: 'quick_create_item',
      source: `QuickCreateMenu.${key}`,
      path,
    }),
  ),
  ...TOP_BAR_ITEMS.map(
    ([source, path]): NavDestination => ({
      surface: 'top_bar_menu_item',
      source,
      path,
    }),
  ),
  ...COMMAND_PALETTE_PATHS.map(
    (path): NavDestination => ({
      surface: 'command_palette_command',
      source: 'CommandPalette.commands',
      path,
    }),
  ),
  ...IN_PAGE_LINKS.map(
    ([source, path]): NavDestination => ({
      surface: 'in_page_link',
      source,
      path,
    }),
  ),
  ...BREADCRUMB_SEGMENTS.map(
    (path): NavDestination => ({
      surface: 'breadcrumb_segment',
      source: 'Breadcrumb.segment',
      path,
    }),
  ),
  ...MODULE_HUB_TILES.map(
    ([slug, path]): NavDestination => ({
      surface: 'module_hub_tile',
      source: `ModuleHub.${slug}`,
      path,
    }),
  ),
];

// -----------------------------------------------------------------------------
// Runtime invariants — fail loudly at import time so the audit, the sweep,
// and any consumer never sees a malformed entry.
// -----------------------------------------------------------------------------
const ALL_SURFACES: readonly NavSurface[] = [
  'side_nav_leaf',
  'quick_create_item',
  'top_bar_menu_item',
  'command_palette_command',
  'in_page_link',
  'breadcrumb_segment',
  'module_hub_tile',
];

for (const entry of built) {
  if (typeof entry.path !== 'string' || entry.path.length === 0) {
    throw new Error(`navDestinations: empty path for ${entry.surface} ${entry.source}`);
  }
  if (!entry.path.startsWith('/')) {
    throw new Error(
      `navDestinations: path must start with '/' (got '${entry.path}') for ${entry.surface} ${entry.source}`,
    );
  }
  if (entry.path.includes(':')) {
    throw new Error(
      `navDestinations: parameterized paths are excluded ('${entry.path}' contains ':') for ${entry.surface} ${entry.source}`,
    );
  }
  if (entry.path.includes('*')) {
    throw new Error(
      `navDestinations: wildcard paths are excluded ('${entry.path}' contains '*') for ${entry.surface} ${entry.source}`,
    );
  }
}

const seenSurfaces = new Set(built.map((e) => e.surface));
for (const surface of ALL_SURFACES) {
  if (!seenSurfaces.has(surface)) {
    throw new Error(
      `navDestinations: surface '${surface}' has zero entries — at least one is required so refactors do not silently drop a surface.`,
    );
  }
}

export const navDestinations: readonly NavDestination[] = Object.freeze(built);

