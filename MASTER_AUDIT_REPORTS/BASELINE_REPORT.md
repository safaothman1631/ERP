# Phase 0 Baseline Report — production_core

**Generated:** 2026-05-25  
**Scope:** Accounting + Sales + Inventory + POS + Iraq localization

## Test Suite

| Check | Result |
|-------|--------|
| Backend pytest | **585 passed** |
| RBAC phase-2 scope | **123/123 protected** (`scripts/audit_rbac_coverage.py`) |
| Frontend endpoint audit | ok=367, mismatch=5, missing=457 (Wave scaffold calls excluded from production_core) |
| Accounting balance script | `python scripts/accounting_balance_check.py` |

## Route Inventory

| Layer | Count |
|-------|-------|
| Backend routes | ~2138 (main.py mount) |
| Frontend pages | 250+ TSX |
| Firestore collections | ~85 core + Wave scaffold |

## Deploy Smoke

| Check | Path |
|-------|------|
| Health | `GET /api/health` |
| Ready | `GET /api/ready` (if configured) |
| Region target | `me-central1` |

## Known Baseline Gaps (accepted)

- `missing=457` frontend→API calls mostly Wave A–D modules (frozen)
- Full Odoo parity out of scope

## Commands

```powershell
cd backend
.\venv\Scripts\python.exe -m pytest tests/ -q
.\venv\Scripts\python.exe scripts\audit_rbac_coverage.py
.\venv\Scripts\python.exe scripts\accounting_balance_check.py
cd ..\frontend
node scripts\endpoint-audit.mjs
npm run build
```
