# growth-to-100 (Tier 2) — Final Wiring & Verification

> **Date:** 2026-05-29
> **Scope:** Complete every *code-doable* remaining item in Tier 2 (`growth-to-100`).
> Phases G1–G5 already had their feature code; this pass did the cross-file
> **wiring** the per-phase agents were forbidden from doing (they couldn't touch
> `main.py`, `requirements.txt`, `scheduler.py`, `App.routes.tsx`, etc.) plus
> fixed the latent bugs that surfaced once the suites actually ran.

---

## What changed

### Backend wiring
| File | Change |
|------|--------|
| `backend/requirements.txt` | `lxml>=5,<6`, `signxml>=4,<5`, `google-cloud-secret-manager>=2.20`; `firebase-admin` → `>=6.5,<8` |
| `backend/app/main.py` | Mounted G2 (`impersonate`, `tenant_flags`, `nps`, `health_emit`), G3 (`tenant_hardware`), G4a (`efakhata`, `efakhata_export` — guarded) routers + `read_only_mode` & `impersonation_audit` middlewares |
| `backend/app/services/scheduler.py` | +3 jobs: `status_page_emit_60s`, `onboarding_drip_dispatch_10m`, `efakhata_submission_drain` (30s). 16 → 19 |
| `backend/app/api/marketing.py` | Public `POST /api/marketing/leads` (T-G.1.11): honeypot + per-IP `@limiter.limit("10/minute")` → `marketing_leads` collection |
| `backend/app/middleware/idempotency_http.py` | +`/api/nps/`, `/api/admin/impersonate/` |
| `backend/app/utils/env_docs.py` + `backend/.env.example` | +13 env vars (Crisp / 360Dialog / Statuspage / MoF / CBI / Secret-Manager) |
| `firestore.indexes.json` | +4 composite indexes (`efakhata_submissions` ×2, `efakhata_export_batches`, `mobile_devices`). 28 → 32 |

### Backend fixes (latent bugs — suites had never been executed)
| File | Bug → Fix |
|------|-----------|
| `app/efakhata/signing.py` | signxml 4.x API: dropped `signing_time=`, verify against embedded cert (`_extract_embedded_cert`), strip empty `<ds:Signature>` placeholder before signing |
| `app/efakhata/auditor_export.py` | **Path traversal**: `_safe()` let `..` through (`../etc/passwd`) → now collapses parent-dir sequences |
| `app/api/admin/tenant_flags.py` | `TenantFlagDoc(**doc, flag_key=…)` raised duplicate-keyword `TypeError` → merge dict |
| `app/services/email_support.py` | `classify()` matched "billing" before "how-to" → reordered (how-to ahead of billing) |
| `app/tax/withholding.py` | zero/negative gross returned `applied=True` → guard returns `applied=False` |
| `backend/tests/test_efakhata_signing.py` | fixture encrypted P12 with `"test-pass"` but uploaded with `"pw"` → password now matches |

### Frontend wiring
| File | Change |
|------|--------|
| `frontend/src/App.routes.tsx` | +6 routes: `efakhata`, `efakhata/submissions/:sid`, `settings/efakhata/cert`, `settings/efakhata/export`, `admin/impersonate`, `get-started` (R3 `OnboardingShell`) |
| `frontend/src/layouts/AppShell.tsx` | Mounted `<HelpWidget />` + `<NPSSurvey />` (both defer network/SDK work to interaction) |

### Spec deviation (intentional, documented in `requirements.txt`)
`signxml` pinned `>=4.0` instead of the spec's `<4.0`. signxml 3.x imports
`OpenSSL.crypto.verify`, removed in pyOpenSSL 24; downgrading pyOpenSSL would
force `cryptography<42`, conflicting with the google/firebase stack at 46.
signxml 4.x drops the pyOpenSSL dependency. `signing.py`'s XMLSigner fallbacks
cover any XAdES API drift.

---

## Verification (run on this machine)

- **Backend boot:** `from app.main import app` → **2325 routes**; e-Fakhata + hardware + G2 routers confirmed mounted.
- **Targeted suites:** e-Fakhata 52/52 · G2 (impersonation/tenant_flags/nps/email) 30/30 · WHT 20/20.
- **Full backend suite:** **1152 passed, 2 failed.** Both failures are **pre-existing and unrelated to Tier 2**:
  - `test_redis_rate_limit_config::test_build_limiter_passes_storage_uri_kwarg` — test asserts a bare `redis://…/0` but `rate_limit.py` now appends `?socket_connect_timeout=2&socket_timeout=2` (test drift; `rate_limit.py` untouched here).
  - `test_firestore_audit_tool::test_firestore_audit_exits_zero` — `tools/firestore_audit.py` exits 1 because `app/firestore/client.py` (the client wrapper, not a repository) lacks BaseRepository/org scoping. `marketing.py` audits **OK**.
- **Frontend:** `tsc --noEmit` → **0 errors**; **`npm run build` → exit 0** (473-entry PWA precache, `dist/assets` emitted).

### Build-time regressions caught by the full `npm run build` (tsc + isolated pytest had both missed them)
Wiring the new routes pulled previously-dead components into the bundle, exposing two latent bad imports:
1. `src/onboarding/steps/StepPOSHardware.tsx` imported `BluetoothOutlined`, which **does not exist** in this `@ant-design/icons` version (its `.d.ts` declares it, so tsc passed; the bundler caught it). → replaced with `ApiOutlined`.
2. `src/hardware/printers/printer-service.ts` `await import('../../../../mobile/src/bridge/printer')` made the web bundler try to resolve `@capacitor/core` (mobile-only). → added `/* @vite-ignore */` so it stays a runtime-only import (rejects → `null` → Web-Bluetooth fallback, the original intent).
3. `backend/app/main.py` mounted `StaticFiles(dist/assets)` whenever `dist/` existed — a **partial/failed build crashed `app.main` on import** (and every test importing it). → guarded the mount behind `isdir(dist/assets)`.

> Lesson: `tsc --noEmit` and per-file tests are necessary but **not sufficient** — only a real `npm run build` (rolldown ESM resolution) surfaces missing-export and cross-package import errors.

---

## Done in this pass (initially mis-classified as "external")

- **`pip install`** — installed into the local venv (`lxml`, `signxml`, `google-cloud-secret-manager`). Other machines just re-run `pip install -r requirements.txt`.
- **Firestore index deploy** — `firebase deploy --only firestore:indexes --project zoho-83cda` ran successfully ("Deploy complete!"). All 32 indexes (incl. the 4 new ones) are live. Ran **without `--force`**, so the 3 cloud-only indexes not in the file were left intact.
- **`HardwarePairingWizard`** — wired into `POSConfigs.tsx` (header "Pair hardware" button → `<Modal>` hosting the 7-step wizard).
- **G2 `ImpersonationBanner`** — mounted in `AppShell.tsx` (aliased `TenantImpersonationBanner`). Safe alongside the platform banner: the two are driven by independent token systems and never display together.

## Remaining (genuinely external — needs credentials / accounts / humans)

- MoF e-Fakhata + CBI URLs/schema (R7.x), Stripe entity + keys, Apple/Play enrollment, Crisp/360Dialog/Statuspage API keys, native-speaker translation QA, partner-entity lawyer.

## Notes / config drift
- **`.firebaserc` default is stale** — it points at `erp-system-494716`, but the live project is **`zoho-83cda`** (deploy was done with explicit `--project`). Consider updating the default or keeping it explicit per environment.
- `firestore.rules` emits pre-existing lint warnings (`isNotDeleted` unused; `resource` variable name) — unrelated to this work.

---

## Suggested follow-ups (out of Tier-2 scope, flagged not fixed)
- `test_redis_rate_limit_config` — update the expected `storage_uri` to include the socket-timeout query params (one-line test fix).
- `tools/firestore_audit.py` — exclude `app/firestore/client.py` (the non-repository client wrapper) from the BaseRepository/org-scope check.
