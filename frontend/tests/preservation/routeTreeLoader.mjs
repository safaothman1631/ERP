/**
 * routeTreeLoader.mjs — text-only loader for `frontend/src/App.routes.tsx`.
 *
 * The preservation tests need a `RouteObject[]` skeleton that can be passed
 * to `matchRoutes` from `react-router`. We deliberately do NOT load the real
 * TSX module — it pulls in React, JSX, every page component, the auth store,
 * AntD, etc., which is overkill for a path-matching test and would force a
 * full Vite/React runtime under Node.
 *
 * Instead we parse the source text and lift out only the `path` field of
 * every route object literal. This mirrors what `frontend/scripts/nav-audit.mjs`
 * does in its router-semantic pass — keeping the loader logic in lockstep
 * with the audit guarantees the preservation tests and the audit see the
 * same view of the tree.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..', '..');
const APP_ROUTES_FILE = path.join(frontendRoot, 'src', 'App.routes.tsx');
const NAV_DESTINATIONS_FILE = path.join(
  frontendRoot,
  'src',
  'layouts',
  'navDestinations.ts',
);

// ----------------------------------------------------------------------------
// Bracket-matching helper. Respects single/double/backtick string literals
// and line/block comments — same logic as the audit script.
// ----------------------------------------------------------------------------
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

function parseRouteObjects(source, startBrace, endBrace) {
  const out = [];
  let i = startBrace + 1;
  while (i < endBrace) {
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

/**
 * Load the path-only `RouteObject[]` extracted from App.routes.tsx.
 * The catch-all `{ path: '*', ... }` IS preserved here so callers can decide
 * whether they want a tree that always matches or the audit-style "matchable"
 * tree (see `stripCatchAll`).
 */
export function loadRoutes() {
  const source = fs.readFileSync(APP_ROUTES_FILE, 'utf8');
  const exportRegex = /export\s+const\s+routes\b[^=]*=\s*/;
  const exportMatch = source.match(exportRegex);
  if (!exportMatch || exportMatch.index === undefined) {
    throw new Error('App.routes.tsx does not export `routes` as expected.');
  }
  const afterEquals = exportMatch.index + exportMatch[0].length;
  if (source[afterEquals] !== '[') {
    throw new Error(
      `App.routes.tsx: expected '[' after \`export const routes ... =\`, got '${source[afterEquals]}'.`,
    );
  }
  const arrEnd = findMatchingBracket(source, afterEquals, '[', ']');
  if (arrEnd < 0) {
    throw new Error('App.routes.tsx: could not find the closing bracket of the `routes` array.');
  }
  return parseRouteObjects(source, afterEquals, arrEnd);
}

/** Drop the catch-all `*` route so matchRoutes only matches real routes. */
export function stripCatchAll(routes) {
  return routes
    .filter((r) => r.path !== '*')
    .map((r) => (r.children ? { ...r, children: stripCatchAll(r.children) } : r));
}

/** Recursive flatten — yields every parameterized route's full path. */
export function flattenRoutes(routes, parentPath = '') {
  const out = [];
  for (const r of routes) {
    const here = r.path === undefined
      ? parentPath
      : r.path.startsWith('/')
        ? r.path
        : parentPath.endsWith('/')
          ? parentPath + r.path
          : `${parentPath}/${r.path}`;
    if (r.path !== undefined) out.push({ path: here });
    if (r.children) out.push(...flattenRoutes(r.children, here));
  }
  return out;
}

/** All parameterized routes (those whose flattened path contains ':'). */
export function getParameterizedRoutes(routes) {
  return flattenRoutes(routes).filter((r) => r.path.includes(':'));
}

/** Dynamic import of the real navDestinations registry (Node strips TS). */
export async function loadNavDestinations() {
  const url = pathToFileURL(NAV_DESTINATIONS_FILE).href;
  const mod = await import(url);
  return mod.navDestinations;
}

/** Dynamic import of react-router's matchRoutes from frontend/node_modules. */
export async function loadMatchRoutes() {
  const rrPkg = path.join(frontendRoot, 'node_modules', 'react-router', 'package.json');
  if (!fs.existsSync(rrPkg)) {
    throw new Error(`react-router is not installed under ${rrPkg}`);
  }
  // Resolve to the package's main export so we get matchRoutes.
  const mod = await import('react-router');
  if (typeof mod.matchRoutes !== 'function') {
    throw new Error("react-router did not export 'matchRoutes'.");
  }
  return mod.matchRoutes;
}

export const paths = {
  frontendRoot,
  APP_ROUTES_FILE,
  NAV_DESTINATIONS_FILE,
};
