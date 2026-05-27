# Zoho ERP (ERPIQ)

Iraq-first SMB ERP: unified accounting, sales, inventory, POS, HR, and platform SaaS ops in one tenant app. Launch scope is **`production_core`** per [`LAUNCH_DECISION.md`](./LAUNCH_DECISION.md).

## Architecture

| Layer | Stack |
|-------|-------|
| Backend | Python / FastAPI, Firestore |
| Frontend | React 19, TypeScript, Vite, Ant Design |
| Deploy | Cloud Run, Firebase, GitHub Actions |

## Key documentation

| Doc | Purpose |
|-----|---------|
| [`LAUNCH_DECISION.md`](./LAUNCH_DECISION.md) | production_core go/no-go |
| [`OPERATIONS_RUNBOOK.md`](./OPERATIONS_RUNBOOK.md) | Deploy, incidents, secrets |
| [`DISASTER_RECOVERY.md`](./DISASTER_RECOVERY.md) | Backup & restore |
| [`docs/ux/ROLES.md`](./docs/ux/ROLES.md) | Role personas & demo users |
| [`docs/ux/MODULE_MATURITY.md`](./docs/ux/MODULE_MATURITY.md) | Module tier matrix |
| [`docs/strategy/COMPETITIVE_SCORECARD.md`](./docs/strategy/COMPETITIVE_SCORECARD.md) | Competitive scores |
| [`docs/ops/INTEGRATION_RUNBOOK.md`](./docs/ops/INTEGRATION_RUNBOOK.md) | E-invoice, WhatsApp, payments |

## Kiro specs (`.kiro/specs/`)

| Spec | Focus |
|------|-------|
| [`erp-competitive-benchmark`](./.kiro/specs/erp-competitive-benchmark/) | Gap closure & scorecard |
| [`phase-1-accounting-hardening`](./.kiro/specs/phase-1-accounting-hardening/) | GL integrity |
| [`phase-2-security-rbac`](./.kiro/specs/phase-2-security-rbac/) | RBAC, encryption, audit |
| [`phase-3-sales-purchase-inventory`](./.kiro/specs/phase-3-sales-purchase-inventory/) | SO/PO/inventory |
| [`phase-4-pos-iraq`](./.kiro/specs/phase-4-pos-iraq/) | POS + Iraq payroll |
| [`phase-5-platform-devops`](./.kiro/specs/phase-5-platform-devops/) | Platform console, CI/CD |
| [`phase-6-final-verification`](./.kiro/specs/phase-6-final-verification/) | E2E & launch verification |
| [`role-adaptive-glass-ux`](./.kiro/specs/role-adaptive-glass-ux/) | Role-based UI |
| [`super-admin-console`](./.kiro/specs/super-admin-console/) | Vendor platform UI |
| [`module-licensing-access`](./.kiro/specs/module-licensing-access/) | Module gates & bundles |

## Run locally

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

### Frontend

```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

App: `http://localhost:5173` · API: `http://localhost:8000`

### Tests

```powershell
# Backend
cd backend
pytest tests/ -q

# Frontend typecheck + build
cd frontend
npx tsc --noEmit
npm run build

# E2E (requires dev servers)
cd frontend
npx playwright test e2e/scenarios/
```

### Demo users

Seed role demo accounts (password `Demo@2026`):

```powershell
cd backend
.\venv\Scripts\python.exe scripts\seed_role_demo_users.py --apply
```

See [`docs/ux/ROLES.md`](./docs/ux/ROLES.md) for the full persona matrix.
