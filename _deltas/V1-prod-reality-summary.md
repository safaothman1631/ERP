# V1 — Production Reality Validation — Summary

> Scope: build the **probe scripts, metric endpoints, and Sentry release automation** that turn the P0–P6 instrumentation into proof per `.kiro/specs/world-class-performance/validation.md` Part 1 (V-PR.1 .. V-PR.12).

This pass adds **no behavioural changes** to the running app — only synthetic probes, an offline-sync heartbeat path, an admin-facing surfacing endpoint, and deploy-gate plumbing. Nothing here modifies `package.json`, `requirements.txt`, `main.tsx`, or `main.py`.

---

## Files added

| File | One-line purpose | V-PR ref |
|------|------------------|----------|
| `scripts/production-reality-probe.mjs` | Sequential synthetic SLO probe — 10 endpoints × 5 samples; emits markdown + `audit/probes/probe-{ISO}.json`; exits 2 if any p95 > 2× SLO | V-PR.1, V-PR.7 |
| `scripts/probe-targets.json` | The 10 endpoint definitions consumed by the probe | V-PR.1 |
| `scripts/slo-thresholds.json` | SLO map per endpoint class (p50/p95/p99/error-rate) from requirements §5 | V-PR.1 |
| `scripts/crash-rate-tracker.mjs` | Sentry sessions API → per-release crash-free % table; 🔴 if any release < 99.5 % | V-PR.3 |
| `scripts/sentry-release-tag.sh` | Wraps `sentry-cli` to create + commit-associate + finalize a release named `$APP_VERSION-$GIT_SHA` on every deploy | V-PR.3, T-V.9 |
| `backend/app/api/offline_sync_health.py` | FastAPI router — `POST /api/health/offline-sync` (heartbeat), `GET /api/admin/offline-sync/summary?tenant_id=` (rollup with 24 h stale flag) | V-PR.4, T-V.10 |
| `frontend/src/observability/offline-sync-heartbeat.ts` | Periodic frontend reporter — reads POS IDB offline-queue every 5 min, POSTs aggregate snapshot with stable ULID device id | V-PR.4 |
| `scripts/rum-summary.mjs` | BigQuery `vitals_raw` → daily p50/p75/p95 of LCP/INP/CLS/TTFB/FCP per device class; falls back to "not enough data" < 1000 events | V-PR.2 |
| `scripts/deploy-gates.sh` | All 8 traffic-shift gates from validation.md §"Gates that block traffic-shift"; called by `deploy-bluegreen.sh` | V-PR.9 + CI gates |
| `backend/app/api/health_offline.py` | Admin-only `GET /api/health/synthetic-summary?since=24h` — surfaces newest `audit/probes/probe-*.json` so alerts can poll | V-PR.1 |
| `audit/probes/.gitkeep` | (already existed — left in place) | — |
| `audit/rum/.gitkeep` | Created — directory for rum-summary output | V-PR.2 |
| `docs/runbooks/bundle-bloat.md` | Per V-PR.9 — triggers, diagnosis (`npm run audit:bundle` + stats.html), mitigation (lazy-load / split / swap deps with sample culprits chart-lib + date-lib), rollback | V-PR.9, V-LM.8 |

---

## Integration steps

### 1. Wire the two new FastAPI routers (one-time edit to `backend/app/main.py`)

Add two `try`-mounted blocks alongside the existing P4/P6 ones around line 498:

```python
try:
    from app.api import offline_sync_health as _ofs
    app.include_router(_ofs.router)
    logging.getLogger(__name__).info("Mounted /api/health/offline-sync (V-PR.4)")
except Exception as _e:  # noqa: BLE001
    logging.getLogger(__name__).warning("offline_sync_health not mounted: %s", _e)

try:
    from app.api import health_offline as _ho
    app.include_router(_ho.router)
    logging.getLogger(__name__).info("Mounted /api/health/synthetic-summary (V-PR.1)")
except Exception as _e:  # noqa: BLE001
    logging.getLogger(__name__).warning("health_offline not mounted: %s", _e)
```

(Per the task constraints I did **not** touch `main.py`; these snippets are for whoever lands the integration PR.)

### 2. Start the frontend heartbeat (one-time edit to `frontend/src/main.tsx`)

After the existing observability boot calls:

```ts
import { startOfflineSyncHeartbeat } from './observability/offline-sync-heartbeat';
startOfflineSyncHeartbeat();
```

### 3. Add deploy-time Sentry tagging

In `.github/workflows/deploy-cloudrun.yml`, after the deploy step:

```yaml
- name: Tag Sentry release
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG:        ${{ vars.SENTRY_ORG_SLUG }}
    SENTRY_PROJECT:    ${{ vars.SENTRY_PROJECT_SLUG }}
    APP_VERSION:       ${{ github.ref_name }}
    GIT_SHA:           ${{ github.sha }}
    SENTRY_ENVIRONMENT: production
  run: ./scripts/sentry-release-tag.sh
```

### 4. Wire deploy-gates into `deploy-bluegreen.sh`

After the soak window but before the `gcloud run services update-traffic --to-latest=100` step, insert:

```bash
CANDIDATE_URL="${CANDIDATE_URL}" CANDIDATE_SHA="${NEW_SHA}" \
  bash "$(dirname "$0")/deploy-gates.sh" \
  || { err "deploy-gates blocked cutover"; exit 1; }
```

### 5. Mark all `.sh` / `.mjs` scripts executable

```bash
chmod +x scripts/production-reality-probe.mjs
chmod +x scripts/crash-rate-tracker.mjs
chmod +x scripts/sentry-release-tag.sh
chmod +x scripts/rum-summary.mjs
chmod +x scripts/deploy-gates.sh
```

(Each script has a `# Set executable bit on commit` comment as a reminder.)

---

## Required env / secret matrix

| Variable | Used by | Required for |
|----------|---------|--------------|
| `PROBE_TARGET_URL` | production-reality-probe.mjs | non-localhost target |
| `PROBE_AUTH_TOKEN` | production-reality-probe.mjs | authenticated endpoint probes |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG_SLUG`, `SENTRY_PROJECT_SLUG` | crash-rate-tracker.mjs, sentry-release-tag.sh, deploy-gates.sh (gate 3) | live Sentry data |
| `APP_VERSION`, `GIT_SHA` | sentry-release-tag.sh | release tagging |
| `SENTRY_ENVIRONMENT`, `SOURCEMAP_DIR`, `URL_PREFIX` | sentry-release-tag.sh | (optional) deploy mark + sourcemap upload |
| `RUM_BIGQUERY_PROJECT`, `RUM_BIGQUERY_DATASET`, `RUM_BIGQUERY_TABLE` | rum-summary.mjs | live BigQuery data |
| `GITHUB_TOKEN`, `GITHUB_REPO`, `CANDIDATE_SHA` | deploy-gates.sh gates 4–8 | CI-status checks |
| `CANDIDATE_URL` | deploy-gates.sh gates 1–2 | candidate revision target |
| `PROBE_AUDIT_DIR` (optional) | health_offline.py | override the `audit/probes/` discovery path |

Every script degrades gracefully (warns + exits 0) when its creds are missing — they all run locally without breaking.

---

## Validation that this layer works

1. `node scripts/production-reality-probe.mjs` against a running backend → prints markdown table + writes `audit/probes/probe-*.json`.
2. `curl -H "Authorization: Bearer <admin-jwt>" 'http://localhost:8000/api/health/synthetic-summary?since=24h'` returns the JSON summary surfaced from step 1.
3. `node scripts/crash-rate-tracker.mjs` with Sentry env set → renders crash-free table; without env → emits a "skipped" stub. (Same shape for `rum-summary.mjs`.)
4. `bash scripts/deploy-gates.sh` with `CANDIDATE_URL=http://localhost:8000` → walks all 8 gates; missing creds for any gate produce a `WARN` and skip rather than failing the run.
5. After heartbeat wiring (step 2 above): POS terminal → `tenants/<tid>/offline_health/<device_id>` Firestore doc updates every 5 min; `GET /api/admin/offline-sync/summary` aggregates them and flips `any_device_stale=true` when any device's `oldest_queued_age_sec > 86400`.

---

## TODOs handed off

- **Hook deploy-gates into `deploy-bluegreen.sh`** — not edited per task constraints.
- **Mount the two new routers in `main.py`** — see integration step 1 above.
- **Start the heartbeat from `main.tsx`** — see integration step 2.
- **GitHub Actions workflow `weekly-health-check.yml`** — Task T-V.8 is still pending; it should call `production-reality-probe.mjs`, `crash-rate-tracker.mjs`, and `rum-summary.mjs` every Monday and commit the results.
- **Sentry CLI in CI image** — `sentry-release-tag.sh` falls back to `npx @sentry/cli`, but adding `sentry-cli` to the runner image saves ~5 s per deploy.
- **BigQuery service account for `rum-summary.mjs`** — requires `bigquery.dataViewer` on the `observability` dataset; tracked in P4 deps.
- **The `dashboard-summary` and `pos-products` probe targets** currently assume those routes exist on the backend — if they're frontend-only roll-ups, replace with concrete equivalents in `probe-targets.json`.
- **Sourcemap upload** in `sentry-release-tag.sh` is optional (set `SOURCEMAP_DIR`); if enabled, ensure the upload happens **before** finalize for accurate source resolution.
