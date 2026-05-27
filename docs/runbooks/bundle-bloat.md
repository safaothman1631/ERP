# Runbook — Bundle Bloat

> **Validation reference:** V-PR.9 (Bundle Size at Production), V-LM.8 (Bundle Size Delta per PR)
> **Owner:** Frontend platform
> **Last rehearsed:** _TBD_

## Why this runbook exists

The app shell is on a strict gz-bundle budget (≤ 350 KB shell, ≤ 80 KB per route chunk — see Requirements R1.5). Crossing the budget produces a visible LCP regression on slow networks and 3G Android devices, which is exactly the audience the Iraq/Kurdistan ERP rollout depends on. When the shell crosses 380 KB gz, `scripts/deploy-gates.sh` (gate 1) refuses to shift 100 % traffic to the candidate revision — so a bundle bloat incident is *also* a deploy outage until resolved.

---

## Triggers

Any of the following fires this runbook:

| Trigger | Source | Threshold |
|---------|--------|-----------|
| Shell exceeds budget on deploy | `scripts/production-reality-probe.mjs` + `deploy-gates.sh` gate 1 | shell > 350 KB gz (advisory), > 380 KB gz (deploy-blocking) |
| Any route chunk exceeds budget | `.github/workflows/bundle-diff.yml` | per-chunk > 80 KB gz |
| Week-over-week growth | `scripts/audit-bundle.mjs` weekly report | shell growth > 10 KB gz |
| PR comment shows large delta | `.github/workflows/bundle-diff.yml` sticky comment | per-chunk +20 KB gz without `[allow-bundle-growth]` |

---

## Diagnosis

### 1. Identify the offender

From the frontend directory:

```bash
cd frontend
npm run build
npm run audit:bundle                # rollup-plugin-visualizer → dist/stats.html
```

Open `dist/stats.html` and sort by gzipped size. The visualizer breaks the bundle down by source module — the top 5 entries are almost always responsible for unexpected growth.

### 2. Compare against `main`

```bash
git fetch origin main
git checkout origin/main -- frontend/dist || true    # if a prebuilt stats file exists in the artifact
# Otherwise build main on a temp worktree and diff stats.json
git worktree add /tmp/main-build origin/main
( cd /tmp/main-build/frontend && npm ci && npm run build )
diff <(jq -S .modules /tmp/main-build/frontend/dist/stats.json) \
     <(jq -S .modules ./dist/stats.json) | less
git worktree remove /tmp/main-build
```

### 3. Cross-check with the CI sticky comment

The `bundle-diff` workflow posts a sticky comment with per-chunk gz deltas. The largest positive delta is your suspect.

---

## Mitigation (in order of preference)

### A. Lazy-load the offender

If the offender is a route-specific feature (chart, editor, scanner SDK), move it behind `React.lazy()` so it lands in its own chunk and only downloads on demand.

```tsx
// Before
import { HeavyChart } from 'some-chart-lib';

// After
const HeavyChart = React.lazy(() => import('some-chart-lib').then(m => ({ default: m.HeavyChart })));
```

Confirm with `npm run build && npm run audit:bundle` that the shell is back under budget.

### B. Code-split a heavy route

For routes whose JS exceeds 80 KB gz, split sub-features:

```ts
// In the router
{ path: '/reports/cashflow', element: <Suspense fallback={<Skeleton/>}><CashflowReport /></Suspense> }
```

### C. Find a smaller dependency

The two most common culprits, by far, in this codebase:

| Symptom | Likely cause | Cheaper alternative |
|---------|--------------|---------------------|
| Suddenly +60–120 KB gz shell, lots of `chart`/`viz` namespace | Pulling all of `chart.js` / `apexcharts` into the shell | Lazy-load the chart route, or switch to `recharts` (tree-shakable) — use sparkline-only imports |
| +25–60 KB gz, `moment`/`date-fns` modules dominate stats | `import moment from 'moment'` or `import * as dateFns from 'date-fns'` | Replace with `dayjs` (≈ 7 KB gz) or per-function `date-fns` imports (`import { format } from 'date-fns'`) |
| +40 KB gz, many small `@fortawesome/*` entries | Importing icons as a barrel | Use SVG sprite or per-icon import |
| +20 KB gz, `lodash` showing up under shell | `import _ from 'lodash'` | Switch to `lodash-es` per-function imports or native ES |

### D. Drop the feature

If the offender added < 1 % business value and > 50 KB gz, it's not worth the LCP regression. Revert.

---

## Rollback

If the bundle bloat shipped (gate failed *after* traffic shift, e.g. weekly audit) and the offender can't be lazy-loaded in the next hour:

```bash
git revert <OFFENDING_PR_SHA>
git push origin HEAD:main
# then trigger a deploy as usual; deploy-gates.sh re-checks gate 1
```

Communicate in `#deploys` channel referencing this runbook and the V-PR.9 metric.

---

## Verification

After mitigation:

1. Local: `cd frontend && npm run build` — confirm `dist/assets/index-*.js` gz size ≤ 350 KB.
2. Open a PR; confirm the `bundle-diff` sticky comment shows neutral or negative delta.
3. After merge, watch the next deploy's `deploy-gates.sh` log — gate 1 should report `gz=<value> KB` with no `FAIL`.
4. The next weekly RUM run (`scripts/rum-summary.mjs`) should show LCP p75 returning to baseline on the affected device classes.

---

## Sample post-mortem template

```
Incident:  Bundle bloat — shell at 412 KB gz (target ≤ 380 KB)
Detected:  2026-MM-DD by deploy-gates.sh gate 1 on rev abc123
Cause:     PR #1234 introduced `import * as charts from 'apexcharts'` in the shell
Mitigation: Moved to React.lazy on the Dashboard route — chunk now 71 KB gz
Resolution: 2026-MM-DD, deploy on rev def456 — gate 1 reported 327 KB
Action:    Add `apexcharts` to the always-lazy ESLint allowlist
```
