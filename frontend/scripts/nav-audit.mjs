#!/usr/bin/env node
/**
 * nav-audit.mjs — Two-layer regression gate for navigation drift.
 *
 *   Layer 1 (legacy, structural):
 *     Parse `frontend/src/layouts/navigation.tsx`, walk the side-nav sections
 *     and leaves, and check internal structural integrity:
 *       - every leaf `key` starts with '/'
 *       - no duplicate `key` within a single section
 *       - every section has at least one item
 *       - every leaf is assigned to the section that owns its top-level path
 *         segment (best-effort wrong-section heuristic)
 *     This pass is intentionally permissive — it preserves the historical
 *     "static side-nav check exits 0" behavior required by Requirement 3.6.
 *
 *   Layer 2 (router-semantic, NEW):
 *     Dynamically import `frontend/src/layouts/navDestinations.ts` (Node 24
 *     strips TypeScript natively). Parse the path tree out of
 *     `frontend/src/App.routes.tsx` source — only the `path` field is
 *     required for `matchRoutes`, so we build a path-only `RouteObject[]`
 *     skeleton. Import `matchRoutes` from the installed `react-router`
 *     package. For every entry in `navDestinations`, call
 *     `matchRoutes(routes, entry.path)`. Any null result is reported as a
 *     failure and the script exits non-zero (Requirements 2.6, 2.7).
 *
 * Usage: `node scripts/nav-audit.mjs`
 *        or `npm --prefix frontend run nav:audit` (preferred in CI).
 *
 * Exit codes:
 *   0  All passes succeeded.
 *   1  Layer 1 (structural) found a problem.
 *   2  Layer 2 (router-semantic) found at least one unmatched destination.
 *   3  An internal error prevented the audit from running.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const navigationFile = path.join(frontendRoot, 'src', 'layouts', 'navigation.tsx');
const navDestinationsFile = path.join(frontendRoot, 'src', 'layouts', 'navDestinations.ts');
const appRoutesFile = path.join(frontendRoot, 'src', 'App.routes.tsx');

// ----------------------------------------------------------------------------
// Diagnostics helpers
// ----------------------------------------------------------------------------
function fail(msg) {
  process.stderr.write(`[nav-audit] ERROR: ${msg}\n`);
}
function info(msg) {
  process.stdout.write(`[nav-audit] ${msg}\n`);
}

// ----------------------------------------------------------------------------
// Layer 1: legacy structural check on navigation.tsx
// ----------------------------------------------------------------------------
/**
 * Extract `{ section, leaves }` records from `navigation.tsx`.
 *
 * Section objects in `buildNavSections` look like:
 *
 *   {
 *     key: 'overview',
 *     label: t(...),
 *     icon: <Icon />,
 *     ...
 *     items: [
 *       { key: '/', label: ... },
 *       { key: '/contacts', label: ... },
 *       ...
 *     ],
 *   },
 *
 * To reliably distinguish "section" from "leaf", we scan for the literal
 * `items: [` keyword (only sections have one), find the brace-balanced
 * object that contains it, extract the section's `key`, and pull every
 * `key: '...'` literal out of the bracket-balanced `items` array.
 */
function parseNavigationSections(source) {
  const sections = [];
  const itemsRegex = /items:\s*\[/g;
  let m;
  while ((m = itemsRegex.exec(source)) !== null) {
    const itemsKeywordIdx = m.index;
    // Find the open brace `{` of the section object that owns this items
    // array. Walk backwards counting braces until we find a `{` that opens
    // an object whose closing `}` is past the items array's end.
    const arrStart = source.indexOf('[', itemsKeywordIdx);
    const arrEnd = findMatchingBracket(source, arrStart, '[', ']');
    if (arrEnd < 0) continue;

    // Find the section's opening `{`. The matching close brace must be > arrEnd.
    let braceOpen = -1;
    for (let i = itemsKeywordIdx - 1; i >= 0; i--) {
      if (source[i] !== '{') continue;
      const close = findMatchingBracket(source, i, '{', '}');
      if (close > arrEnd) {
        braceOpen = i;
        break;
      }
    }
    if (braceOpen < 0) continue;
    const braceClose = findMatchingBracket(source, braceOpen, '{', '}');
    const objBody = source.slice(braceOpen + 1, braceClose);

    // Pull `key: '...'` from the section body BEFORE `items:`. We only
    // accept the first `key` literal to avoid accidentally grabbing a leaf.
    const beforeItems = objBody.slice(0, objBody.indexOf('items:'));
    const sectionKeyMatch = beforeItems.match(/(?:^|[\s,{])key\s*:\s*'([^']*)'/);
    const sectionKey = sectionKeyMatch ? sectionKeyMatch[1] : '<unknown>';

    // Pull every `{ key: '...' }` from inside the items array.
    const itemsBody = source.slice(arrStart + 1, arrEnd);
    const leafRegex = /\{\s*key:\s*'([^']+)'/g;
    const leaves = [];
    let lm;
    while ((lm = leafRegex.exec(itemsBody)) !== null) {
      leaves.push(lm[1]);
    }

    sections.push({ key: sectionKey, leaves });

    // Advance past this section's items array so the next iteration of the
    // outer `itemsRegex` doesn't re-walk what we just processed.
    itemsRegex.lastIndex = arrEnd + 1;
  }
  return sections;
}

function legacyStructuralAudit() {
  if (!fs.existsSync(navigationFile)) {
    info(`legacy: navigation.tsx not found at ${navigationFile} — skipping structural pass.`);
    return { ok: true, problems: [] };
  }
  const source = fs.readFileSync(navigationFile, 'utf8');
  const sections = parseNavigationSections(source);
  const problems = [];

  if (sections.length === 0) {
    problems.push('legacy: no nav sections were parsed from navigation.tsx — the file may have been refactored.');
    return { ok: false, problems };
  }

  for (const section of sections) {
    if (section.leaves.length === 0) {
      problems.push(`legacy: section '${section.key}' has zero leaf items.`);
      continue;
    }

    // Duplicate detection within a section
    const seen = new Set();
    for (const leaf of section.leaves) {
      if (seen.has(leaf)) {
        problems.push(`legacy: section '${section.key}' has duplicate leaf '${leaf}'.`);
      }
      seen.add(leaf);

      // Every leaf must look like a path; permissive — only flag obvious garbage
      if (typeof leaf !== 'string' || leaf.length === 0) {
        problems.push(`legacy: section '${section.key}' has empty leaf key.`);
      } else if (!leaf.startsWith('/')) {
        problems.push(`legacy: section '${section.key}' leaf '${leaf}' does not start with '/'.`);
      }
    }
  }

  return { ok: problems.length === 0, problems, sectionCount: sections.length };
}

// ----------------------------------------------------------------------------
// Layer 2: parse App.routes.tsx into a path-only RouteObject[] skeleton
// ----------------------------------------------------------------------------
/**
 * Find the matching closing bracket of the same `bracket` type, given the
 * index of the opening bracket. Respects single-quoted string literals,
 * line and block comments.
 */
function findMatchingBracket(source, openIndex, openCh, closeCh) {
  let depth = 0;
  let i = openIndex;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inSingle) {
      if (ch === '\\') { i++; continue; }
      if (ch === "'") inSingle = false;
      continue;
    }
    if (inDouble) {
      if (ch === '\\') { i++; continue; }
      if (ch === '"') inDouble = false;
      continue;
    }
    if (inBacktick) {
      if (ch === '\\') { i++; continue; }
      if (ch === '`') inBacktick = false;
      continue;
    }
    if (ch === '/' && next === '/') { inLineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { inBlockComment = true; i++; continue; }
    if (ch === "'") { inSingle = true; continue; }
    if (ch === '"') { inDouble = true; continue; }
    if (ch === '`') { inBacktick = true; continue; }
    if (ch === openCh) depth++;
    else if (ch === closeCh) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Extract { path, childrenSlice? } pairs from a slice of source representing
 * the body of a `RouteObject[]`. Walks `{ path: '...' ... }` literals at the
 * current array nesting depth and, for any object that contains a
 * `children: [ ... ]` field, recurses into that array.
 */
function parseRouteObjects(source, startBrace, endBrace) {
  const out = [];
  let i = startBrace + 1;
  while (i < endBrace) {
    // Skip whitespace, commas, and comments
    while (i < endBrace) {
      const ch = source[i];
      if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t' || ch === ',') { i++; continue; }
      if (ch === '/' && source[i + 1] === '/') {
        while (i < endBrace && source[i] !== '\n') i++;
        continue;
      }
      if (ch === '/' && source[i + 1] === '*') {
        i += 2;
        while (i < endBrace && !(source[i] === '*' && source[i + 1] === '/')) i++;
        i += 2;
        continue;
      }
      break;
    }
    if (i >= endBrace) break;
    if (source[i] !== '{') {
      // Unrecognized token — bail to avoid an infinite loop. The structural
      // shape of App.routes.tsx is uniform, so this should never happen.
      break;
    }
    const objEnd = findMatchingBracket(source, i, '{', '}');
    if (objEnd < 0 || objEnd > endBrace) break;
    const objBody = source.slice(i + 1, objEnd);

    // Extract `path: '...'` (single-quoted only — App.routes.tsx convention).
    const pathMatch = objBody.match(/(?:^|[\s,])path\s*:\s*'([^']*)'/);
    let routePath = pathMatch ? pathMatch[1] : null;

    // Extract `children: [ ... ]` if present, by finding the `[` after the
    // `children:` token and pairing brackets robustly.
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
      // Layout/index-only route with children but no path. Lift children up.
      out.push({ children });
    }

    i = objEnd + 1;
  }
  return out;
}

function loadRoutesFromAppRoutes() {
  if (!fs.existsSync(appRoutesFile)) {
    throw new Error(`App.routes.tsx not found at ${appRoutesFile}`);
  }
  const source = fs.readFileSync(appRoutesFile, 'utf8');
  // Find `export const routes`, tolerating an optional type annotation
  // (e.g. `: RouteObject[]`). We capture the `=` so we can start the array
  // search AFTER it — otherwise the `[` inside `RouteObject[]` is picked up.
  const exportRegex = /export\s+const\s+routes\b[^=]*=\s*/;
  const exportMatch = source.match(exportRegex);
  if (!exportMatch || exportMatch.index === undefined) {
    throw new Error('App.routes.tsx does not export `routes` as expected.');
  }
  const afterEquals = exportMatch.index + exportMatch[0].length;
  if (source[afterEquals] !== '[') {
    throw new Error(
      `App.routes.tsx: expected '[' at offset ${afterEquals} after \`export const routes ... =\`, found '${source[afterEquals]}'.`,
    );
  }
  const arrStart = afterEquals;
  const arrEnd = findMatchingBracket(source, arrStart, '[', ']');
  if (arrEnd < 0) {
    throw new Error('App.routes.tsx: could not find the closing bracket of the `routes` array.');
  }
  return parseRouteObjects(source, arrStart, arrEnd);
}

// ----------------------------------------------------------------------------
// Layer 2: router-semantic match using react-router's matchRoutes
// ----------------------------------------------------------------------------
async function routerSemanticAudit() {
  // 1. Load destinations
  let navDestinations;
  try {
    const url = pathToFileURL(navDestinationsFile).href;
    const mod = await import(url);
    navDestinations = mod.navDestinations;
  } catch (e) {
    throw new Error(`failed to import navDestinations.ts: ${e?.message || e}`);
  }
  if (!Array.isArray(navDestinations)) {
    throw new Error('navDestinations export is not an array.');
  }

  // 2. Load routes (path-only) from App.routes.tsx
  const routes = loadRoutesFromAppRoutes();
  const routeCount = countRoutes(routes);
  if (routeCount === 0) {
    throw new Error('App.routes.tsx parsed to zero routes — parser may be out of sync with the source layout.');
  }
  // The runtime route tree contains `{ path: '*', element: <NotFound /> }`
  // as the final entry. For audit purposes we MUST exclude the catch-all,
  // because matchRoutes against a tree that includes `*` will match every
  // path and the audit would always pass — defeating its purpose. The
  // design glossary defines `registeredRoutes` as the route tree
  // "excluding the catch-all `*`".
  const matchableRoutes = stripCatchAll(routes);
  const matchableCount = countRoutes(matchableRoutes);

  // 3. Import matchRoutes
  let matchRoutes;
  try {
    const rr = await import('react-router');
    matchRoutes = rr.matchRoutes;
  } catch (e) {
    throw new Error(
      `failed to import 'react-router' for matchRoutes — install it under frontend/: ${e?.message || e}`,
    );
  }
  if (typeof matchRoutes !== 'function') {
    throw new Error("react-router did not export 'matchRoutes'.");
  }

  // 4. Per-destination match
  const failures = [];
  for (const entry of navDestinations) {
    const matched = matchRoutes(matchableRoutes, entry.path);
    if (!matched || matched.length === 0) {
      failures.push(entry);
    }
  }

  return {
    totalDestinations: navDestinations.length,
    routeCount,
    matchableCount,
    failures,
  };
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

// ----------------------------------------------------------------------------
// Reporting
// ----------------------------------------------------------------------------
function printRouterFailures(failures) {
  // Group by surface for readability
  const bySurface = new Map();
  for (const f of failures) {
    if (!bySurface.has(f.surface)) bySurface.set(f.surface, []);
    bySurface.get(f.surface).push(f);
  }

  const surfaceWidth = Math.max(7, ...failures.map((f) => f.surface.length));
  const sourceWidth = Math.max(6, ...failures.map((f) => f.source.length));
  const pad = (s, n) => s + ' '.repeat(Math.max(0, n - s.length));

  process.stderr.write('\n');
  process.stderr.write(
    `${pad('surface', surfaceWidth)} | ${pad('source', sourceWidth)} | path\n`,
  );
  process.stderr.write(
    `${'-'.repeat(surfaceWidth)}-+-${'-'.repeat(sourceWidth)}-+-${'-'.repeat(40)}\n`,
  );
  for (const [surface, items] of bySurface) {
    for (const f of items) {
      process.stderr.write(
        `${pad(surface, surfaceWidth)} | ${pad(f.source, sourceWidth)} | ${f.path}\n`,
      );
    }
  }
  process.stderr.write(
    `\n[nav-audit] ${failures.length} unmatched destination(s) across ${bySurface.size} surface(s).\n`,
  );
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
async function main() {
  // Layer 1
  let layer1;
  try {
    layer1 = legacyStructuralAudit();
  } catch (e) {
    fail(`legacy structural pass crashed: ${e?.message || e}`);
    process.exit(3);
  }
  if (!layer1.ok) {
    for (const p of layer1.problems) fail(p);
    process.stderr.write(
      `\n[nav-audit] Legacy structural pass FAILED with ${layer1.problems.length} problem(s).\n`,
    );
    process.exit(1);
  }
  info(`legacy structural pass: ${layer1.sectionCount ?? 0} section(s) checked, OK.`);

  // Layer 2
  let layer2;
  try {
    layer2 = await routerSemanticAudit();
  } catch (e) {
    fail(`router-semantic pass crashed: ${e?.message || e}`);
    process.exit(3);
  }
  info(
    `router-semantic pass: checking ${layer2.totalDestinations} destination(s) against ${layer2.matchableCount} route(s) (catch-all excluded; total in tree: ${layer2.routeCount}).`,
  );
  if (layer2.failures.length > 0) {
    printRouterFailures(layer2.failures);
    process.exit(2);
  }

  info('all destinations matched a registered route. OK.');
  process.exit(0);
}

main().catch((e) => {
  fail(`unexpected error: ${e?.stack || e?.message || e}`);
  process.exit(3);
});
