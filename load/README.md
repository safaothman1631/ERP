# Load Testing — k6 suite

> **Spec ref:** requirements.md §5 (SLOs), §13.4; tasks.md T-6.7; design.md §8.3
> **Owner:** BE + DevOps

This folder holds the k6 scripts that exercise the top 20 critical
endpoint families against **staging**. We never run them against
production: production has live tenants, and a bad threshold trip would
page the on-call.

## 1. Layout

```
load/
├── README.md                  ← you are here
└── k6-suite/
    ├── _shared.js             ← auth, base URL, headers, thresholds
    ├── pos-checkout.js        ← end-to-end POS sale; 50 VUs / 10 min
    ├── invoice-list.js        ← paginated list; 40 VUs / 5 min
    ├── contacts-search.js     ← typeahead + fuzzy; 30 VUs / 5 min
    └── dashboard.js           ← aggregation fan-out; 20 VUs / 5 min
```

## 2. Run locally

### Prerequisites

* k6 0.49 or newer: https://k6.io/docs/get-started/installation/
* A running backend (local `uvicorn` or a private staging URL).
* A test user that exists in the target environment.

### Quickstart

```bash
# Against a local backend
K6_BASE_URL=http://localhost:8000 \
K6_USER_EMAIL=loadtest@zoho.kurd.iq \
K6_USER_PASSWORD='please-set' \
k6 run load/k6-suite/pos-checkout.js
```

### Against staging

```bash
K6_BASE_URL=https://staging-api.erp.zoho.kurd.iq \
K6_USER_EMAIL=loadtest@zoho.kurd.iq \
K6_USER_PASSWORD="$(op read 'op://Ops/k6-staging/password')" \
K6_TENANT_ID=tenant-loadtest \
k6 run load/k6-suite/invoice-list.js
```

### Shorten a run while developing

```bash
K6_DURATION_OVERRIDE=30s k6 run load/k6-suite/dashboard.js
```

The shared helper rewrites every stage to `30s`, so a full 12-minute
suite finishes in ~ 90 seconds — useful when iterating on a script.

## 3. CI: nightly schedule

`.github/workflows/load-test.yml` runs the full suite every night at
02:00 UTC (05:00 Baghdad) and on manual dispatch.

The workflow:

1. Spins up Ubuntu, installs k6 via `grafana/setup-k6-action`.
2. Reads the staging URL + creds from repo secrets (`LOAD_TEST_TARGET_URL`, `LOAD_TEST_USER_EMAIL`, `LOAD_TEST_USER_PASSWORD`, `LOAD_TEST_TENANT_ID`).
3. Runs each script in a matrix job (one script = one runner = parallel).
4. Uploads the `*.summary.json` + an HTML view as a build artifact.
5. Updates a single sticky issue titled "k6 load-test nightly results" with the latest table.

On manual dispatch you can:

* Override the target URL (`target_url` input).
* Pick a subset of scripts (`scripts: pos-checkout,dashboard`).
* Override the duration (`duration_override: 2m`).

## 4. Thresholds & SLO mapping

The thresholds in each script trace back to requirements.md §5:

| Script | Class | p95 budget | Failure budget |
|---|---|---|---|
| `pos-checkout` | POS checkout end-to-end | 400ms | 0.05% |
| `invoice-list` | Paginated list, page 1 | 300ms | 0.1% |
| `invoice-list` | Paginated list, page N | 400ms | 0.1% |
| `contacts-search` | Search + typeahead | 500ms | 0.2% |
| `dashboard` | Aggregation / report | 1500ms | 0.5% |

The CI build **fails** if any threshold is breached. The failure is then
surfaced via the standard repo-failure → PagerDuty pipeline.

## 5. Reading the output

Each script writes `<name>.summary.json` (machine-readable) and the CI
job renders a small HTML companion. Open `<name>.html` in a browser for
a table view; the JSON is suitable for ingestion into BigQuery
(`load_runs` table, see design.md §8.3).

Key metrics:

* `http_req_duration` — request latency. The `p(95)` is what we gate on.
* `http_req_failed.rate` — failure rate. Must be below the SLO budget.
* Custom: `pos_checkout_total_ms` — end-to-end checkout duration trend.

## 6. Triage when CI fails

1. Open the failing workflow's logs in GitHub Actions.
2. Download the `k6-report-<script>` artifact.
3. Compare against last week's sticky-issue snapshot — is this a step change, or a slow drift?
4. Step change → recent deploy is the prime suspect. Check `deploy-cloudrun.yml` runs since the last green load test.
5. Slow drift → likely tenant growth or index degradation; file a ticket against the backend perf board.
6. Update the sticky issue with the triage note (do not let it linger as an unowned red).

## 7. Caveats

* Carts and contacts written by k6 are **labelled** (ids start with `cart-` or `vu-`) so a nightly cleanup job can prune them. Don't run k6 against a tenant that contains real data.
* The threshold thresholds (`p(95)`) work on whatever ran during the test — a 30s sample is noisy. Trust the 12-minute run, not a 30-second smoke.
* k6 does not respect HTTP/2 push or service-worker caches; the numbers represent **origin** behaviour, not what the user sees behind the edge.

## 8. Local dev tips

* Add `--out json=raw.json` to keep the per-request log.
* Add `--no-vu-connection-reuse` to simulate cold connections (useful when debugging cold-start budgets).
* Use the k6 cloud dashboard (`k6 run -o cloud ...`) for live charts during a long run.
