# Firestore Depth Remediation — Executive Audit (2026-05-26)

**Spec:** `.kiro/specs/firestore-depth-remediation/`  
**Prior waves:** data-integrity-wave ✅ · firestore-performance-resilience ✅ (code) · **this wave** closes remaining gaps

## Verdict (updated 2026-05-26 post-implementation)

| Layer | Status |
|-------|--------|
| **Integrity (money/stock hot paths)** | ✅ Waves A2 + prior atomics deployed |
| **List performance (core + reports)** | ✅ Wave R+E+P1 — `reports.py` zero list(10k) |
| **Deploy topology** | ✅ `europe-west1` + `cloudrun-deploy-env.yaml` revision `zoho-erp-00024-d57` |
| **Industry scaffold modules** | ✅ Wave S — `collect_stream` on all dashboard stats |
| **Bill payment + JE** | ✅ `create_payment_made_with_je_atomic` when GL configured |
| **Transfer / MO stock** | ✅ `warehouse_stock` on transfer complete; MO done + `warehouse_id` |

**No blocking data corruption** on demo org (0 drift). Residual: enable staging flags (search prefix, Redis rate limit) after index build.

## Quantified debt (2026-05-26 scan)

| Metric | Count |
|--------|------:|
| `list(limit=10000)` in `app/api` + `app/services` | **~80** |
| `reports.py` capped scans | **11** + 6 `collect_stream` (still 10k cap) |
| Journal `get_lines` N+1 | **3** functions |
| Atomic gaps (CRITICAL/HIGH) | **15** flows |
| Missing/wrong composite indexes | **9** shapes |
| Deploy flag gaps | **3** (`USE_FIRESTORE_QUERY`, `FIREBASE_PROJECT_ID`, `SEARCH_PREFIX`) |

## P0 before enabling all prod flags

1. `deploy-cloudrun.yml` → `europe-west1` + `cloudrun-deploy-env.yaml`
2. `deploy-firestore.yml` project = **`zoho-83cda`**
3. Deploy new indexes (see `design.md` §4)
4. Smoke: invoices/bills list with `cursor` + one report endpoint

## Implementation order

```
O (ops/deploy) → R (reports) → E (exports/l10n) → A2 (atomic wave 2) → I2 (industry defer)
```

See `tasks.md` for checkboxes.
