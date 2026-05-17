#!/usr/bin/env node
/**
 * nav-audit.exploration.mjs — Property 1 (Bug Condition) exploration test for
 * the navigation-404-fix bugfix spec (Task 1).
 *
 * Goal: surface concrete counterexamples that demonstrate at least one static
 * authenticated nav destination falls through to the `*` catch-all when the
 * runtime route tree (`frontend/src/App.routes.tsx`) is matched against the
 * full seven-surface enumeration.
 *
 * Property under test (encodes `isBugCondition` from bugfix.md):
 *   For input (surface, destination, sessionState = authenticated_user) where
 *   destination is static, there SHALL exist `route ∈ registeredRoutes` such
 *   that `matchRoutes(routes, destination) ≠ null`. Equivalently: the
 *   rendered page after navigating to destination SHALL NOT be NotFound.
 *
 * Enumeration (the SAME enumeration the runtime exploration spec walks
 * via direct navigation, kept in lock-step):
 *   1. side_nav_leaf            — sampled side-nav dropdown sub-items
 *   2. quick_create_item        — every entry in QUICK_ITEMS
 *   3. command_palette_command  — sampled palette commands
 *   4. in_page_link             — known suspect in-page CTAs
 *      (RouteTitleSync.tsx::TITLES, pages/Settings.tsx, pages/onboarding/*,
 *       storefront in-page links)
 *
 * Exit codes:
 *   0  Every enumerated destination matches a registered route (FIX is in).
 *   2  At least one destination falls through to the catch-all (BUG present).
 *   3  Internal error.
 *
 * On UNFIXED `main` this script is EXPECTED TO EXIT 2 — the failure IS the
 * proof of the bug. After the fix, this script must exit 0.
 *
 * The output is also written to `frontend/scripts/nav-audit.report.txt` as a
 * committed reference artifact.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const appRoutesFile = path.join(frontendRoot, 'src', 'App.routes.tsx');
const reportFile = path.join(__dirname, 'nav-audit.exploration.log.txt');

// -----------------------------------------------------------------------------
// Seven-surface enumeration (sampled per task 1's "minimal sweep" guidance,
// extended with the in-page-link surface that produced the original
// counterexamples). Mirror of the runtime enumeration in
// `tests/e2e/nav-sweep.exploration.spec.ts`.
// -----------------------------------------------------------------------------
const ENUMERATION = [
  // --- side-nav leaves (sampled across sections) -----------------------------
  { surface: 'side_nav_leaf',           source: 'navigation.tsx',                                   path: '/contacts' },
  { surface: 'side_nav_leaf',           source: 'navigation.tsx',                                   path: '/items' },
  { surface: 'side_nav_leaf',           source: 'navigation.tsx',                                   path: '/invoices' },
  { surface: 'side_nav_leaf',           source: 'navigation.tsx',                                   path: '/banking' },
  { surface: 'side_nav_leaf',           source: 'navigation.tsx',                                   path: '/inventory/warehouses' },
  { surface: 'side_nav_leaf',           source: 'navigation.tsx',                                   path: '/manufacturing/orders' },

  // --- quick-create entries (mirror QUICK_ITEMS) ----------------------------
  { surface: 'quick_create_item',       source: 'QuickCreateMenu.tsx',                              path: '/invoices/new' },
  { surface: 'quick_create_item',       source: 'QuickCreateMenu.tsx',                              path: '/bills' },
  { surface: 'quick_create_item',       source: 'QuickCreateMenu.tsx',                              path: '/contacts' },
  { surface: 'quick_create_item',       source: 'QuickCreateMenu.tsx',                              path: '/items' },
  { surface: 'quick_create_item',       source: 'QuickCreateMenu.tsx',                              path: '/quotes' },
  { surface: 'quick_create_item',       source: 'QuickCreateMenu.tsx',                              path: '/journals' },

  // --- command-palette commands (sampled) -----------------------------------
  { surface: 'command_palette_command', source: 'CommandPalette.tsx',                               path: '/reports' },
  { surface: 'command_palette_command', source: 'CommandPalette.tsx',                               path: '/settings' },
  { surface: 'command_palette_command', source: 'CommandPalette.tsx',                               path: '/dashboards' },

  // --- in-page CTAs / breadcrumb-derived TITLES (the known suspect surfaces
  //     that produced the original counterexample list on UNFIXED code) -----
  { surface: 'in_page_link',            source: 'pages/Settings.tsx (landing_page=/dashboard)',    path: '/dashboard' },
  { surface: 'in_page_link',            source: 'pages/onboarding/OnboardingChecklist.tsx',         path: '/dashboard' },
  { surface: 'in_page_link',            source: 'pages/onboarding/OnboardingWizard.tsx skip',       path: '/dashboard' },
  { surface: 'in_page_link',            source: 'pages/onboarding/OnboardingWizard.tsx finish',     path: '/dashboard' },
  { surface: 'in_page_link',            source: 'RouteTitleSync.tsx::TITLES /timesheets',           path: '/timesheets' },
  { surface: 'in_page_link',            source: 'RouteTitleSync.tsx::TITLES /warehouses',           path: '/warehouses' },
  { surface: 'in_page_link',            source: 'RouteTitleSync.tsx::TITLES /crm',                  path: '/crm' },
  { surface: 'in_page_link',            source: 'pages/storefront in-page link',                    path: '/store/product' },
  { surface: 'in_page_link',            source: 'pages/storefront in-page link',                    path: '/store/order' },
];

// -----------------------------------------------------------------------------
// Bracket-balanced parser borrowed from nav-audit.mjs — produces a path-only
// RouteObject[] skeleton from App.routes.tsx that matchRoutes can consume.
// -----------------------------------------------------------------------------
function findMatchingBracket(source, openIndex, openCh, closeCh) {
  let depth = 0;
  let i = openIndex;
  let inSingle = false, inDouble = false, inBacktick = false;
  let inLineComment = false, inBlockComment = false;
  for (; i < source.length; i++) {
    const ch = source[i], next = source[i + 1];
    if (inLineComment) { if (ch === '\n') inLineComment = false; continue; }
    if (inBlockComment) { if (ch === '*' && next === '/') { inBlockComment = false; i++; } continue; }
    if (inSingle) { if (ch === '\\') { i++; continue; } if (ch === "'") inSingle = false; continue; }
    if (inDouble) { if (ch === '\\') { i++; continue; } if (ch === '"') inDouble = false; continue; }
    if (inBacktick) { if (ch === '\\') { i++; continue; } if (ch === '`') inBacktick = false; continue; }
    if (ch === '/' && next === '/') { inLineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { inBlockComment = true; i++; continue; }
    if (ch === "'") { inSingle = true; continue; }
    if (ch === '"') { inDouble = true; continue; }
    if (ch === '`') { inBacktick = true; continue; }
    if (ch === openCh) depth++;
    else if (ch === closeCh) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function parseRouteObjects(source, startBrace, endBrace) {
  const out = [];
  let i = startBrace + 1;
  while (i < endBrace) {
    while (i < endBrace) {
      const ch = source[i];
      if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t' || ch === ',') { i++; continue; }
      if (ch === '/' && source[i + 1] === '/') { while (i < endBrace && source[i] !== '\n') i++; continue; }
      if (ch === '/' && source[i + 1] === '*') {
        i += 2;
        while (i < endBrace && !(source[i] === '*' && source[i + 1] === '/')) i++;
        i += 2; continue;
      }
      break;
    }
    if (i >= endBrace) break;
    if (source[i] !== '{') break;
    const objEnd = findMatchingBracket(source, i, '{', '}');
    if (objEnd < 0 || objEnd > endBrace) break;
    const objBody = source.slice(i + 1, objEnd);
    const pathMatch = objBody.match(/(?:^|[\s,])path\s*:\s*'([^']*)'/);
    let routePath = pathMatch ? pathMatch[1] : null;
    let children = null;
    const childrenIdx = objBody.search(/(?:^|[\s,])children\s*:\s*\[/);
    if (childrenIdx >= 0) {
      const arrStartRel = objBody.indexOf('[', childrenIdx);
      const arrStartAbs = (i + 1) + arrStartRel;
      const arrEndAbs = findMatchingBracket(source, arrStartAbs, '[', ']');
      if (arrEndAbs > 0 && arrEndAbs <= objEnd) {
        children = parseRouteObjects(source, arrStartAbs, arrEndAbs);
      }
    }
    if (routePath !== null) {
      const node = { path: routePath };
      if (children) node.children = children;
      out.push(node);
    } else if (children) {
      out.push({ children });
    }
    i = objEnd + 1;
  }
  return out;
}

function loadRoutesFromAppRoutes() {
  const source = fs.readFileSync(appRoutesFile, 'utf8');
  const exportRegex = /export\s+const\s+routes\b[^=]*=\s*/;
  const exportMatch = source.match(exportRegex);
  if (!exportMatch || exportMatch.index === undefined) {
    throw new Error('App.routes.tsx does not export `routes`.');
  }
  const afterEquals = exportMatch.index + exportMatch[0].length;
  if (source[afterEquals] !== '[') {
    throw new Error(`Expected '[' after export const routes =, got '${source[afterEquals]}'.`);
  }
  const arrEnd = findMatchingBracket(source, afterEquals, '[', ']');
  return parseRouteObjects(source, afterEquals, arrEnd);
}

function stripCatchAll(routes) {
  return routes
    .filter((r) => r.path !== '*')
    .map((r) => (r.children ? { ...r, children: stripCatchAll(r.children) } : r));
}

function countRoutes(routes) {
  let n = 0;
  for (const r of routes) {
    if (r.path !== undefined) n++;
    if (r.children) n += countRoutes(r.children);
  }
  return n;
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
async function main() {
  const routes = loadRoutesFromAppRoutes();
  const matchableRoutes = stripCatchAll(routes);
  const total = countRoutes(matchableRoutes);

  let matchRoutes;
  try {
    const rr = await import('react-router');
    matchRoutes = rr.matchRoutes;
  } catch (e) {
    process.stderr.write(`[nav-audit.exploration] failed to import react-router: ${e?.message || e}\n`);
    process.exit(3);
  }

  const failures = [];
  for (const entry of ENUMERATION) {
    const matched = matchRoutes(matchableRoutes, entry.path);
    if (!matched || matched.length === 0) {
      failures.push(entry);
    }
  }

  // -----------------------------
  // Reporting
  // -----------------------------
  const surfaceWidth = Math.max(7, ...ENUMERATION.map((e) => e.surface.length));
  const sourceWidth = Math.max(6, ...ENUMERATION.map((e) => e.source.length));
  const pad = (s, n) => s + ' '.repeat(Math.max(0, n - s.length));

  const lines = [];
  lines.push(`# nav-audit.exploration.mjs — Property 1 (Bug Condition) report`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push(`# Routes (matchable): ${total}`);
  lines.push(`# Enumerated destinations: ${ENUMERATION.length}`);
  lines.push(`# Unmatched (counterexamples): ${failures.length}`);
  lines.push('');
  if (failures.length === 0) {
    lines.push('Result: PASS — every enumerated destination matches a registered route.');
    lines.push('Property 1 (Bug Condition) is no longer reproducible against the current route tree.');
  } else {
    lines.push('Result: FAIL — bug condition reproduced.');
    lines.push('');
    lines.push(`${pad('surface', surfaceWidth)} | ${pad('source', sourceWidth)} | path`);
    lines.push(`${'-'.repeat(surfaceWidth)}-+-${'-'.repeat(sourceWidth)}-+-${'-'.repeat(40)}`);
    for (const f of failures) {
      lines.push(`${pad(f.surface, surfaceWidth)} | ${pad(f.source, sourceWidth)} | ${f.path}`);
    }
    lines.push('');
    lines.push('Root-cause categories (per design.md "Hypothesized Root Cause"):');
    lines.push('  - never-audited surfaces: in-page CTA / RouteTitleSync TITLES paths');
    lines.push('  - missing index/redirect routes: e.g. /dashboard, /crm, /warehouses, /timesheets');
    lines.push('  - storefront base paths missing index: /store/product, /store/order');
  }

  // Write report to disk
  fs.writeFileSync(reportFile, lines.join('\n') + '\n', 'utf8');

  // Echo to stderr/stdout
  for (const l of lines) {
    if (failures.length === 0 || !l.startsWith('side_') && !l.startsWith('quick_') && !l.startsWith('command_') && !l.startsWith('in_page_')) {
      process.stdout.write(l + '\n');
    } else {
      process.stderr.write(l + '\n');
    }
  }

  process.exit(failures.length === 0 ? 0 : 2);
}

main().catch((e) => {
  process.stderr.write(`[nav-audit.exploration] unexpected error: ${e?.stack || e?.message || e}\n`);
  process.exit(3);
});
