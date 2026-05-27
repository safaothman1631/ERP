# P6 — Summary of deliverables

> **Phase:** P6 — DevOps Hardening, Security, Mobile Wrapper, Load Tests, DR
> **Spec ref:** requirements.md §7, §10, §12, §13.4; design.md §5, §6, §7; tasks.md T-6.1 .. T-6.8
> **Status:** All files created; ready for review.

## 1. Files created / updated

| # | Path | One-line summary |
|---|---|---|
| 1 | `vercel.json` | Vercel edge config: rewrites `/api/*` → Cloud Run, CSP report-only, HSTS, image opt, immutable asset caching. |
| 2 | `backend/app/api/csp_report.py` | `POST /api/csp-report` endpoint storing last 1000 reports in Redis (TTL 7d) and emitting structured logs. |
| 3 | `docs/security/csp.md` | Full CSP policy, two-stage rollout plan, verification commands, known exception rationale. |
| 4 | `docs/security/secret-rotation.md` | Rotation policy table, per-secret runbook, calendar reminders, owners + escalation. |
| 5 | `docs/security/workload-identity-federation.md` | Step-by-step WIF setup, side-by-side migration plan, rollback strategy. |
| 6 | `docs/security/pii-handling.md` | P0/P1/P2/P3 classification, export + delete API, 30-day soft delete, PDPL alignment. |
| 7 | `scripts/rotate-secret.sh` | Bash rotator: new Secret Manager version + Cloud Run roll + health probe + 24h-grace finalize. |
| 8 | `.github/workflows/security-scan.yml` | npm audit, pip-audit, CodeQL (JS + Python), Gitleaks; push + weekly + dispatch. |
| 9 | `.github/workflows/load-test.yml` | Nightly k6 matrix; uploads HTML/JSON; updates a sticky issue with results. |
| 10 | `load/k6-suite/pos-checkout.js` | 50 VUs / 10 min POS checkout end-to-end, p95 < 400 ms threshold. |
| 11 | `load/k6-suite/invoice-list.js` | 40 VUs / 5 min paginated list (page 1 + page N + drill-in). |
| 12 | `load/k6-suite/contacts-search.js` | 30 VUs / 5 min typeahead + full fuzzy search. |
| 13 | `load/k6-suite/dashboard.js` | 20 VUs / 5 min aggregation fan-out via `http.batch`. |
| 14 | `load/k6-suite/_shared.js` | Shared helpers: auth, base URL, headers, threshold templates, duration override. |
| 15 | `load/README.md` | How to run locally, how CI schedules it, threshold ↔ SLO mapping, triage. |
| 16 | `mobile/package.json` | Capacitor wrapper deps + scripts; workspace-style link to `../frontend/dist`. |
| 17 | `mobile/capacitor.config.ts` | `com.zoho.kurdishierp`, `webDir=../frontend/dist`, BLE + scanner + splash + status-bar plugins. |
| 18 | `mobile/README.md` | Android Studio / Xcode setup, device run, live-reload dev, release notes. |
| 19 | `mobile/src/bridge/printer.ts` | BLE ESC/POS printer; same interface as `usePOSPrinter` web fallback. |
| 20 | `mobile/src/bridge/scanner.ts` | ML Kit barcode (one-shot + continuous + torch); pre-warms model. |
| 21 | `mobile/src/bridge/nfc.ts` | NFC interface + `NotImplementedYet` stub (Sprint+1). |
| 22 | `docs/runbooks/pos-offline-drill.md` | 24-h POS offline drill SOP — setup, execution, reconcile, triage. |
| 23 | `docs/runbooks/chunk-load-failure.md` | Chunk-load Sentry spike triage (deploy race, CDN POP, SW stale shell). |
| 24 | `docs/runbooks/slow-firestore-read.md` | Firestore p99 > 1s triage (tenant / collection / listener / region). |
| 25 | `docs/runbooks/redis-down.md` | Redis outage response — fail-open behaviour, recreate, region failover. |
| 26 | `docs/runbooks/cold-start-spike.md` | Cold-start triage — config check, boot-phase logs, traffic capacity. |
| 27 | `docs/runbooks/cwv-regression.md` | LCP / INP / CLS triage with route × device × region slicing + rollback. |
| 28 | `DISASTER_RECOVERY.md` | **Updated.** RTO=1h / RPO=5m, full failure-class playbooks, drill log preserved. |
| 29 | `audit/dr/2026-Q3-drill.md` | Template for the next quarterly DR drill — pre-flight, timing log, sign-off. |
| 30 | `docs/adr/0000-template.md` | ADR template — context, decision, consequences, alternatives, validation. |
| 31 | `docs/adr/0001-firestore-over-postgres.md` | Sample ADR for D-001 (Firestore vs Postgres+Hasura). |
| 32 | `docs/adr/0002-workbox-sw.md` | Sample ADR for D-002 (Workbox via `vite-plugin-pwa`). |
| 33 | `docs/adr/0003-capacitor-mobile.md` | Sample ADR for D-005 (Capacitor vs RN / Flutter / native / PWA-only). |

Plus the two `_deltas/*` files:

* `_deltas/P6-deps.md` — every dependency to install + every secret to create.
* `_deltas/P6-summary.md` — this file.

## 2. Files NOT modified

Per the phase contract:

* `.github/workflows/ci.yml`, `ci-quality.yml`, `deploy-cloudrun.yml`, `deploy-firestore.yml`, `prelaunch-ops.yml`, `backup-verify.yml`.
* `Dockerfile`, `docker-compose.yml`, `docker-compose.prod.yml`.
* `backend/requirements.txt`, `backend/app/main.py`.
* `frontend/package.json`, `frontend/src/App.tsx`.

The wiring from `main.py` to the new `csp_report` router is **deferred to the operator** (see §4 below).

## 3. Deps to add

See `_deltas/P6-deps.md`. Summary:

* **Mobile only (new):** Capacitor 6 + community BLE + ML Kit barcode.
* **Frontend:** no new deps.
* **Backend:** no new deps.
* **CI:** no install (workflows fetch tools per-job).

## 4. Manual ops the user needs to do

These cannot be done by the agent and require credentials we don't have:

| # | Step | Owner | Why |
|---|---|---|---|
| 1 | Add `CLOUDRUN_URL` to Vercel project env. | DevOps | `vercel.json` rewrites depend on it. |
| 2 | Wire `csp_report.router` into `backend/app/main.py`: `from app.api import csp_report; app.include_router(csp_report.router)`. | BE | We were forbidden from modifying `main.py`. |
| 3 | Create the GCP Workload Identity Pool + Provider + IAM bindings. | DevOps | See `docs/security/workload-identity-federation.md` §2. Requires Project IAM Admin. |
| 4 | Add the secrets enumerated in `_deltas/P6-deps.md` §6 (`LOAD_TEST_*`, etc.). | DevOps | GitHub repo secrets. |
| 5 | `cd mobile && npm install && npm run add:android && npm run add:ios`. | FE / mobile | Capacitor scaffolds the `android/` and `ios/` folders the first time. |
| 6 | Verify `gha-key.json` at repo root is removed once WIF cutover Day 30 reached. | DevOps | A JSON SA key exists today (`/zoho/gha-key.json`) — should be rotated out per the WIF migration plan. |
| 7 | Schedule the 2026-Q3 DR drill on the ops calendar; assign IC + Operator + Scribe. | Tech lead | Audit template at `audit/dr/2026-Q3-drill.md`. |
| 8 | Provision the load-test staging tenant + user; seed 1000 SKUs for the POS drill. | BE | Used by both `load-test.yml` and the POS offline drill. |
| 9 | Deploy the new workflows: they trigger on push to main automatically; verify the first scheduled `security-scan` and `load-test` runs succeed. | DevOps | Watch the first nightly to catch matrix-job issues. |
| 10 | Submit the Capacitor Android internal-track build to Play Console (T-6.6). | Mobile | Requires upload key + Play Console access. |

## 5. TODOs / known gaps

* **`scripts/rotate-secret.sh`** assumes `gcloud`, `openssl`, `curl` are on the operator's PATH. The script is `chmod +x` and includes a `--dry-run` mode for first use.
* **CSP nonce strategy** (open question OQ-2) is documented but not implemented — the policy ships with `'unsafe-inline'` during Stage 1. Stage 2 requires an ADR-0004 + Vercel edge function (see `docs/security/csp.md` §5).
* **NFC bridge** (`mobile/src/bridge/nfc.ts`) is an interface-only stub; full plugin choice deferred to Sprint+1 (Capacitor NFC plugin ecosystem is still maturing).
* **Workload Identity Federation migration** is documented but **not** applied — the existing JSON key (`gha-key.json` at repo root) needs to be rotated out per the documented Day-30 plan.
* **k6 nightly** will fail on first run if secrets are unset — that's intentional (loud failure beats silent skip).
* **The 2026-Q3 DR drill template** is empty by design; it gets filled on drill day.

## 6. Acceptance against tasks.md P6

| Task | Status |
|---|---|
| T-6.1 — CSP report-only → enforced | Report-only header + sink endpoint shipped. 14-day soak + enforce flip is operational, not code. |
| T-6.2 — Workload Identity Federation | Documented migration plan shipped. Operator must execute. |
| T-6.3 — Secret rotation policy + tooling | Policy doc + `scripts/rotate-secret.sh` shipped. |
| T-6.4 — PII export + delete | Documented; the per-tenant zip-export endpoint stub remains for the operator's BE pass. |
| T-6.5 — Capacitor wrapper | `mobile/` scaffolded; native projects to be generated with `cap add android/ios`. |
| T-6.6 — Google Play pre-launch | Path documented in `mobile/README.md`; submission is manual. |
| T-6.7 — k6 load of top endpoints | 4 scripts + nightly workflow + sticky-issue reporter shipped. |
| T-6.8 — DR quarterly drill | `DISASTER_RECOVERY.md` rewritten with the new RTO/RPO + playbooks; `audit/dr/2026-Q3-drill.md` template shipped. |

## 7. Notes for the next phase agent

* The Vercel rewrite uses `${CLOUDRUN_URL}` — Vercel substitutes from project env on deploy. If you change the env var name, also update `_deltas/P6-deps.md` §6 to keep it documented.
* `vite-plugin-pwa` is referenced by ADR-0002 but **not yet present** in `frontend/package.json` — it lands in P3, not P6. ADR is forward-looking.
* When wiring the CSP report router into `main.py`, place the `include_router(csp_report.router)` call **before** any catch-all middleware so the 204 response is not intercepted.
* The `audit/secrets/rotations.csv` file referenced by the rotation script does not exist yet; it gets created on first rotation. Add it to `.gitignore` if it should not be committed.
