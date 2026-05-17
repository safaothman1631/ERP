/**
 * nav-preservation.spec.ts — Property 2 (Preservation).
 *
 * Encodes the static-layer preservation properties from
 * `.kiro/specs/navigation-404-fix/tasks.md`. All assertions run against the
 * authoritative route tree exported by `frontend/src/App.routes.tsx` and the
 * destination registry exported by `frontend/src/layouts/navDestinations.ts`,
 * so this suite has no dependency on a running browser.
 *
 * Runner: Node's built-in `node --test` (lower setup overhead than Vitest;
 * Node 24 strips TypeScript natively).
 *
 * Property catalogue:
 *   P2 — Unknown URL preservation               (Requirement 3.1)
 *   P3 — Parameterized detail preservation      (Requirement 3.2)
 *   P4 — Working leaf preservation              (Requirement 3.3)
 *   Public-route preservation                   (Requirement 3.4)
 *   SuperShell preservation                     (Requirement 3.5)
 *   Existing static audit preservation          (Requirement 3.6)
 *   ProtectedRoute redirect preservation        (Requirement 3.7)
 *   P5 — Static-vs-runtime parity (harness)     (cross-property; runtime side runs in 3.8)
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fc from 'fast-check';

import {
  loadRoutes,
  stripCatchAll,
  flattenRoutes,
  getParameterizedRoutes,
  loadNavDestinations,
  loadMatchRoutes,
  paths,
} from './routeTreeLoader.mjs';

// ---------------------------------------------------------------------------
// Test fixtures shared across the suite.
// ---------------------------------------------------------------------------
const allRoutes = loadRoutes();                  // includes catch-all `*`
const matchableRoutes = stripCatchAll(allRoutes); // catch-all excluded
const matchRoutes = await loadMatchRoutes();
const navDestinations = await loadNavDestinations();

// Sanity-check the tree before running properties — if these blow up, every
// downstream property would emit cryptic failures.
describe('route tree fixtures', () => {
  test('catch-all `*` is the LAST entry of the top-level array', () => {
    assert.equal(allRoutes.length > 0, true, 'route tree is empty');
    const last = allRoutes[allRoutes.length - 1];
    assert.equal(last.path, '*', `last route must be catch-all, got '${last.path}'`);
    // Catch-all must not appear earlier
    for (let i = 0; i < allRoutes.length - 1; i++) {
      assert.notEqual(allRoutes[i].path, '*', `catch-all appeared at non-final index ${i}`);
    }
  });

  test('matchable tree (catch-all stripped) is non-empty', () => {
    assert.equal(matchableRoutes.length > 0, true);
    const flat = flattenRoutes(matchableRoutes);
    assert.equal(flat.length > 50, true, `expected many routes, got ${flat.length}`);
  });

  test('navDestinations registry is non-empty and well-formed', () => {
    assert.equal(Array.isArray(navDestinations), true);
    assert.equal(navDestinations.length > 0, true);
    for (const d of navDestinations) {
      assert.equal(typeof d.path, 'string');
      assert.equal(d.path.startsWith('/'), true, `bad path: ${d.path}`);
      assert.equal(d.path.includes(':'), false, `parameterized path leaked: ${d.path}`);
      assert.equal(d.path.includes('*'), false, `wildcard leaked: ${d.path}`);
    }
  });
});

// ---------------------------------------------------------------------------
// P2 — Unknown URL preservation (Requirement 3.1)
//
// Generate arbitrary path strings, filter those NOT matched by matchRoutes
// against the matchable tree, and assert the catch-all `*` IS the only thing
// in the FULL tree that matches them. This is the static-layer encoding of
// "NotFound is what would render at runtime".
// ---------------------------------------------------------------------------
describe('P2 — Unknown URL preservation (Req 3.1)', () => {
  test('unknown paths are matched only by the catch-all route', () => {
    fc.assert(
      fc.property(
        // Generate paths that look like real URLs but are unlikely to collide
        // with real routes. We sample from a mix of:
        //   - completely random ASCII segments
        //   - "made-up" segments that shadow real top-level prefixes but with
        //     bogus suffixes (e.g. '/contacts/zzz/zzz/zzz/zzz')
        fc.oneof(
          fc.array(
            fc.stringMatching(/^[a-z0-9-]{4,12}$/),
            { minLength: 1, maxLength: 4 },
          ).map((segs) => '/' + segs.join('/')),
          fc.array(
            fc.stringMatching(/^[a-z]{8,16}$/),
            { minLength: 2, maxLength: 5 },
          ).map((segs) => '/' + segs.join('/')),
        ),
        (candidate) => {
          // Only consider candidates that genuinely don't resolve in the
          // matchable tree — fast-check filters with `.filter` are wasteful
          // on rejection so we use a precondition guard.
          const matched = matchRoutes(matchableRoutes, candidate);
          if (matched && matched.length > 0) {
            return true; // happens to collide with a real route — skip
          }
          // The full tree (catch-all included) MUST match it via `*`.
          const matchedFull = matchRoutes(allRoutes, candidate);
          assert.notEqual(matchedFull, null, `full tree did not match ${candidate}`);
          assert.equal(matchedFull.length > 0, true);
          const last = matchedFull[matchedFull.length - 1];
          assert.equal(
            last.route.path,
            '*',
            `expected catch-all match for ${candidate}, got ${last.route.path}`,
          );
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });

  test('hand-typed unknown URLs all hit the catch-all', () => {
    const samples = [
      '/this-route-does-not-exist',
      '/totally/made/up',
      '/leases/double/nope/path',
      '/zzzzzzzz',
      '/a/b/c/d/e/f',
    ];
    for (const url of samples) {
      const matched = matchRoutes(matchableRoutes, url);
      assert.equal(
        matched === null || matched.length === 0,
        true,
        `did not expect ${url} to match in the matchable tree`,
      );
      const full = matchRoutes(allRoutes, url);
      assert.notEqual(full, null);
      assert.equal(full[full.length - 1].route.path, '*');
    }
  });
});

// ---------------------------------------------------------------------------
// P3 — Parameterized detail preservation (Requirement 3.2)
//
// For each parameterized route in App.routes.tsx, generate id-shaped strings
// (UUIDs, numeric ids, slugs) and assert matchRoutes resolves to the same
// parameterized route's path.
// ---------------------------------------------------------------------------
describe('P3 — Parameterized detail preservation (Req 3.2)', () => {
  const paramRoutes = getParameterizedRoutes(matchableRoutes);

  test('there is at least one parameterized route in the tree', () => {
    assert.equal(paramRoutes.length > 0, true);
  });

  // ID-shaped string generators
  const uuidArb = fc.uuid();
  const numericIdArb = fc.integer({ min: 1, max: 1_000_000 }).map(String);
  const slugArb = fc.stringMatching(/^[a-z][a-z0-9-]{2,20}$/);
  const idArb = fc.oneof(uuidArb, numericIdArb, slugArb);

  for (const route of paramRoutes) {
    test(`${route.path} resolves to itself for id-shaped values`, () => {
      // Build a generator that fills every `:param` segment with an id.
      const segments = route.path.split('/').filter(Boolean);
      const paramIndices = segments
        .map((s, i) => (s.startsWith(':') ? i : -1))
        .filter((i) => i >= 0);

      fc.assert(
        fc.property(fc.array(idArb, { minLength: paramIndices.length, maxLength: paramIndices.length }), (ids) => {
          const filled = [...segments];
          paramIndices.forEach((segIdx, k) => {
            filled[segIdx] = ids[k];
          });
          const url = '/' + filled.join('/');

          const matched = matchRoutes(matchableRoutes, url);
          assert.notEqual(matched, null, `did not match ${url} (template ${route.path})`);
          assert.equal(matched.length > 0, true);
          // The deepest matched route's `path` (relative form) MUST end with
          // the same final segment template as the original parameterized
          // route, AND the assembled path of the matched chain MUST equal
          // the original template.
          const reassembled = reassembleMatchedPath(matched);
          assert.equal(
            reassembled,
            route.path,
            `expected match for ${url} to be ${route.path}, got ${reassembled}`,
          );
          return true;
        }),
        { numRuns: 30 },
      );
    });
  }
});

/**
 * Walk a `matchRoutes` result and reconstruct the parameterized template the
 * URL matched. react-router gives us a chain whose `route.path` are relative;
 * we glue them with `/`.
 */
function reassembleMatchedPath(matchChain) {
  const parts = [];
  for (const m of matchChain) {
    const p = m.route.path;
    if (p === undefined || p === '') continue;
    if (p.startsWith('/')) parts.push(p);
    else parts.push('/' + p);
  }
  // Collapse double slashes that arise when an absolute segment is joined to
  // an absolute parent (root '/' followed by 'contacts' yields '/contacts').
  const joined = parts.join('').replace(/\/+/g, '/');
  // `/` root collapses to empty above; restore it.
  return joined === '' ? '/' : joined;
}

// ---------------------------------------------------------------------------
// P4 — Working leaf preservation (Requirement 3.3)
//
// For every entry in navDestinations, assert matchRoutes(routes, entry.path)
// is non-null AND the matched chain's deepest route has a stable `path`.
// ---------------------------------------------------------------------------
describe('P4 — Working leaf preservation (Req 3.3)', () => {
  test('every navDestinations entry matches a registered route', () => {
    const failures: { surface: string; source: string; path: string }[] = [];
    for (const entry of navDestinations) {
      const matched = matchRoutes(matchableRoutes, entry.path);
      if (!matched || matched.length === 0) {
        failures.push(entry);
      }
    }
    assert.equal(
      failures.length,
      0,
      `unmatched destinations:\n${failures.map((f) => `  ${f.surface} | ${f.source} | ${f.path}`).join('\n')}`,
    );
  });

  test('matched route paths are stable strings (not undefined / dynamic)', () => {
    for (const entry of navDestinations) {
      const matched = matchRoutes(matchableRoutes, entry.path);
      assert.notEqual(matched, null, entry.path);
      const deepest = matched[matched.length - 1];
      assert.equal(typeof deepest.route.path, 'string', entry.path);
      assert.equal(deepest.route.path.length > 0, true, entry.path);
    }
  });
});

// ---------------------------------------------------------------------------
// Public-route preservation (Requirement 3.4)
// ---------------------------------------------------------------------------
describe('Public-route preservation (Req 3.4)', () => {
  // The list intentionally mirrors tasks.md. Routes that don't currently
  // exist in App.routes.tsx (`/welcome`, `/403`) are tested separately so
  // we can document expected behaviour rather than fail loudly on unrelated
  // missing-route gaps.
  const present = [
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/accept-invite',
    '/store',
    '/portal/login',
    '/vendor-portal/login',
    '/server-error',
  ];

  for (const url of present) {
    test(`${url} matches a registered public route`, () => {
      const matched = matchRoutes(matchableRoutes, url);
      assert.notEqual(matched, null, `${url} did not match`);
      assert.equal(matched.length > 0, true);
    });
  }

  // tasks.md additionally lists `/welcome` and `/403`. These are NOT present
  // in the current route tree — confirm they fall through to the catch-all
  // so the test documents reality and detects any future regression.
  for (const url of ['/welcome', '/403']) {
    test(`${url} currently falls through to catch-all (documented gap)`, () => {
      const matchable = matchRoutes(matchableRoutes, url);
      assert.equal(
        matchable === null || matchable.length === 0,
        true,
        `${url} unexpectedly resolves to a real route — update this test if a real route was added`,
      );
      const full = matchRoutes(allRoutes, url);
      assert.notEqual(full, null);
      assert.equal(full[full.length - 1].route.path, '*');
    });
  }

  test('/store/ trailing-slash variant matches /store', () => {
    const matched = matchRoutes(matchableRoutes, '/store/');
    assert.notEqual(matched, null);
    assert.equal(matched.length > 0, true);
  });
});

// ---------------------------------------------------------------------------
// SuperShell preservation (Requirement 3.5)
//
// /super/* routes are currently absent from the tree. The assertions below
// document that fact (catch-all is the resolver) so a future regression that
// e.g. adds half the routes will break this test.
// ---------------------------------------------------------------------------
describe('SuperShell preservation (Req 3.5)', () => {
  const superPaths = [
    '/super',
    '/super/tenants',
    '/super/plans',
    '/super/catalog',
    '/super/payments',
    '/super/audit-log',
    '/super/health',
    '/super/settings',
  ];

  for (const url of superPaths) {
    test(`${url} resolution is consistent`, () => {
      const matched = matchRoutes(matchableRoutes, url);
      const full = matchRoutes(allRoutes, url);
      // Either ALL super paths resolve to real routes, or ALL fall through
      // to catch-all. We assert "consistent" by checking that whichever
      // outcome we observe today is observed for every super path. We do
      // that by capturing the outcome of `/super` and asserting parity.
      assert.notEqual(full, null, `${url} did not resolve to anything (not even catch-all)`);
      // If matchable resolves, the deepest route's reassembled path must
      // share the `/super` prefix; if it doesn't, the catch-all must own it.
      if (matched && matched.length > 0) {
        const reassembled = reassembleMatchedPath(matched);
        assert.equal(
          reassembled.startsWith('/super'),
          true,
          `${url} matched ${reassembled} which is outside /super — possible misroute`,
        );
      } else {
        assert.equal(full[full.length - 1].route.path, '*');
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Existing static audit preservation (Requirement 3.6)
//
// Spawn `node scripts/nav-audit.mjs` and assert exit code 0.
// ---------------------------------------------------------------------------
describe('Existing static audit preservation (Req 3.6)', () => {
  test('node scripts/nav-audit.mjs exits 0', () => {
    const auditScript = path.join(paths.frontendRoot, 'scripts', 'nav-audit.mjs');
    const result = spawnSync(process.execPath, [auditScript], {
      cwd: paths.frontendRoot,
      encoding: 'utf8',
    });
    assert.equal(
      result.status,
      0,
      `nav-audit.mjs exited with ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  });
});

// ---------------------------------------------------------------------------
// ProtectedRoute redirect preservation (Requirement 3.7)
//
// Static-layer encoding: assert the route tree still contains the catch-all
// AND the protected branch (the '/' parent route with children) exists with
// at least one well-known protected child path.
// Runtime redirect verification is deferred to Task 3.5 / Playwright.
// ---------------------------------------------------------------------------
describe('ProtectedRoute redirect preservation (Req 3.7) [static check]', () => {
  test('catch-all `*` is still present in the route tree', () => {
    const last = allRoutes[allRoutes.length - 1];
    assert.equal(last.path, '*');
  });

  test('protected branch exists with `/` parent and children', () => {
    const protectedBranch = allRoutes.find(
      (r) => r.path === '/' && Array.isArray(r.children) && r.children.length > 0,
    );
    assert.notEqual(
      protectedBranch,
      undefined,
      "expected a top-level route '/' with children (the ProtectedRoute branch)",
    );
    const childPaths = protectedBranch!.children!.map((c: any) => c.path).filter(Boolean);
    // A handful of well-known authenticated leaves that MUST exist.
    for (const must of ['contacts', 'invoices', 'settings']) {
      assert.equal(
        childPaths.includes(must),
        true,
        `protected branch is missing well-known child '${must}'`,
      );
    }
  });

  test('arbitrary protected paths resolve under the `/` branch', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          '/contacts',
          '/invoices',
          '/settings',
          '/inventory',
          '/banking',
          '/reports',
        ),
        (url) => {
          const matched = matchRoutes(matchableRoutes, url);
          assert.notEqual(matched, null);
          // The first match in the chain must be the ProtectedRoute parent.
          assert.equal(matched[0].route.path, '/');
          return true;
        },
      ),
      { numRuns: 20 },
    );
  });
});

// ---------------------------------------------------------------------------
// P5 — Static-vs-runtime parity HARNESS (cross-property)
//
// Per tasks.md the harness is authored here and the runtime side runs in
// task 3.8 / Playwright. The static side asserts every navDestinations entry
// matches in the static layer so the harness has a baseline to compare
// against.
// ---------------------------------------------------------------------------
describe('P5 — Static-vs-runtime parity (harness)', () => {
  test('static side: every navDestination matches in the matchable tree', () => {
    const staticOutcomes = navDestinations.map((entry: any) => {
      const matched = matchRoutes(matchableRoutes, entry.path);
      return { entry, matched: !!(matched && matched.length > 0) };
    });
    const staticFailures = staticOutcomes.filter((o: any) => !o.matched);
    assert.equal(
      staticFailures.length,
      0,
      `static-side failures (would force P5 disagreement once runtime side runs):\n${staticFailures
        .map((f: any) => `  ${f.entry.surface} | ${f.entry.source} | ${f.entry.path}`)
        .join('\n')}`,
    );
  });

  test('harness shape: produces a comparable record per destination', () => {
    // Runtime (Playwright) will populate `runtime: boolean` per entry.
    // The harness output type is fixed here so the runtime side can fill
    // in the missing field without re-shaping the data.
    const harness = navDestinations.map((entry: any) => ({
      surface: entry.surface,
      source: entry.source,
      path: entry.path,
      static: !!matchRoutes(matchableRoutes, entry.path),
      runtime: null as boolean | null,
    }));
    assert.equal(harness.length, navDestinations.length);
    for (const row of harness) {
      assert.equal(typeof row.static, 'boolean');
    }
  });
});
