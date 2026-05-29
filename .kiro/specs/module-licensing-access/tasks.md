# Tasks: Module Licensing & Access Requests

**Estimate:** 2–3 weeks (1 backend + 1 frontend)  
**Depends on:** existing onboarding (`industries.ts`, `ModuleGuard`, `onboarding.py`)

---

## Phase A — Backend foundation (3–4 days)

- [ ] **A1** Create `backend/app/services/module_registry.py` — module keys, router prefix map, `ALWAYS_ON`
- [ ] **A2** Create `backend/app/services/org_license.py` — bundles, `get_allowed_modules`, expiry check
- [ ] **A3** Add `organizations.license` field + migration script for existing orgs → `full_core` or legacy passthrough
- [ ] **A4** Implement `require_module()` in `backend/app/services/module_gate.py`
- [ ] **A5** Apply `require_module` to core routers: sales, purchase, inventory, pos, crm, hr, manufacturing (top 7)
- [ ] **A6** Add permissions: `platform.manage`, `modules.request`, `modules.approve`, `modules.view` in `permissions.py`
- [ ] **A7** Tests: `test_module_gate.py`, `test_org_license.py`

---

## Phase B — Request workflow API (2–3 days)

- [ ] **B1** Firestore repo `ModuleAccessRequestRepository` → collection `module_access_requests`
- [ ] **B2** `POST/GET/approve/reject` endpoints in `onboarding.py` or `module_requests.py`
- [ ] **B3** Block self-service `PUT /preferences` when `require_module_approval=true` and caller lacks `modules.approve`
- [ ] **B4** `GET /api/onboarding/license` — returns `{ allowed_modules, bundle_id, require_module_approval }`
- [ ] **B5** Audit log on approve/reject
- [ ] **B6** Tests: `test_module_requests.py` — full lifecycle, subset approve, pool violation 400

---

## Phase C — Platform admin API (1–2 days)

- [ ] **C1** `backend/app/api/platform.py` — `PUT /api/platform/orgs/{id}/license`
- [ ] **C2** Platform admin guard (env `PLATFORM_ADMIN_USER_IDS` or org flag)
- [ ] **C3** Tests: non-platform user → 403

---

## Phase D — Frontend onboarding (2–3 days)

- [ ] **D1** `frontend/src/onboarding/bundles.ts` — bundle definitions (mirror backend)
- [ ] **D2** Extend onboarding store: `license`, `pendingRequest`, `requireModuleApproval`
- [ ] **D3** Refactor onboarding step 4: request mode vs self-select mode
- [ ] **D4** `PendingApprovalScreen.tsx` — status + resubmit if rejected
- [ ] **D5** i18n keys (ku/en/ar): request sent, awaiting admin, approved, rejected
- [ ] **D6** E2E: `e2e/scenarios/module-request.spec.ts`

---

## Phase E — Admin UI (2 days)

- [ ] **E1** `ModuleRequestsPage.tsx` — list, approve/reject modals
- [ ] **E2** Settings nav link (admin only)
- [ ] **E3** Notification badge on sidebar when pending count > 0
- [ ] **E4** Update Settings → Modules section to show license pool vs enabled

---

## Phase F — Platform vendor UI (1–2 days)

- [ ] **F1** `OrgLicenseEditor.tsx` — bundle picker + module multiselect + expiry
- [ ] **F2** Route `/platform/orgs` or tab in super-admin settings
- [ ] **F3** Wire to `PUT /api/platform/orgs/{id}/license`

---

## Phase G — Hardening & docs (1 day)

- [ ] **G1** Update `OPERATIONS_RUNBOOK.md` — how vendor provisions POS-only org
- [ ] **G2** Script `backend/scripts/set_org_license.py --org-id X --bundle pos_only`
- [ ] **G3** Verify `SideNav` + `ModuleGuard` with partial enabled set
- [ ] **G4** RBAC + module gate integration test (sales disabled → invoices 403)

---

## Implementation order (recommended)

```
A1→A2→A4→B1→B2→D3→E1→A5→G4
     ↓
    C1 (parallel if multi-tenant vendor needed day-1)
```

---

## Quick wins (can ship in 1 sprint slice)

1. **License pool only** (A1–A3 + D2 + F1): vendor caps modules; admin still self-selects within pool
2. **Add approval** (B* + E*): request workflow on top
3. **API enforce** (A4–A5): security hardening last
