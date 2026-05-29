# Global Quick-Create Selector Rollout — Tasks

> Each item is a single page or a single related set of edits. Mark `[x]` as you land each one.

## Phase 0 — Audit confirmation

- [x] Run `grep -rE '<Select\b' frontend/src/{pages,components}` (excluding tests/specs/node_modules) and capture all sites whose `options` derive from a registered entity collection.
- [x] Verify each candidate's entity slug exists in `QUICK_CREATE_REGISTRY`. None of the in-scope sites need a new registry entry.

## Phase 1 — Bills & expense flows

- [x] `frontend/src/pages/Bills.tsx`
  - [x] Vendor select → `<SelectWithQuickCreate entity="vendor" .../>`
  - [x] Account select → `<SelectWithQuickCreate entity="account" .../>`
- [x] `frontend/src/pages/Expenses.tsx`
  - [x] Account select (line 120) → `<SelectWithQuickCreate entity="account" .../>`

## Phase 2 — Sales flows (customer pickers in long-tail pages)

- [x] `frontend/src/pages/RecurringInvoices.tsx`
  - [x] Customer select (line 145) → `<SelectWithQuickCreate entity="customer" .../>`
- [x] `frontend/src/pages/SalesOrders.tsx`
  - [x] Customer select (line 134) → `<SelectWithQuickCreate entity="customer" .../>`

## Phase 3 — Inventory & operations

- [x] `frontend/src/pages/Inventory.tsx`
  - [x] Item select (line 126) → `<SelectWithQuickCreate entity="item" .../>`
  - [x] Account select (line 129) → `<SelectWithQuickCreate entity="account" .../>`
- [x] `frontend/src/pages/MfgBOMs.tsx`
  - [x] Item select (line 96) → `<SelectWithQuickCreate entity="item" .../>`
- [x] `frontend/src/pages/Warehouses.tsx`
  - [x] Location parent select (line 289) → `<SelectWithQuickCreate entity="location" .../>`
  - [x] Location move-target select (line 292) → `<SelectWithQuickCreate entity="location" .../>`

## Phase 4 — Configuration & cross-module

- [x] `frontend/src/pages/BankRules.tsx`
  - [x] Account select (line 251) → `<SelectWithQuickCreate entity="account" .../>`
  - [x] Contact select (line 255) — use `<SelectWithQuickCreate entity="customer" .../>` (generic; BankRules can match either party, customer registry serves both for create).
- [x] `frontend/src/pages/Projects.tsx`
  - [x] Customer select (line 89) → `<SelectWithQuickCreate entity="customer" .../>`

## Phase 5 — Verification

- [x] Audit pass: `grep -rE '<Select\b' frontend/src/pages` filtered against entity arrays returns zero matches.
- [ ] Run `npm run build` in `frontend/` and confirm no TypeScript errors introduced.
- [ ] Run `npm run lint` and confirm `local/quick-create-select` reports zero violations across `frontend/src`.
- [ ] Run `npm run audit:empty-states` and commit the updated `audit/empty-state-baseline.json`.
- [ ] Smoke each migrated page on the local dev server (`http://127.0.0.1:5173`) with a tenant that has zero records of the in-scope entity — confirm the CTA appears, opens the modal/drawer, saves, and auto-selects.

## Phase 6 — Documentation

- [ ] Append an entry to `_deltas/empty-state-final-state.md` noting the post-EP-0 long-tail closure and listing the files touched.
- [ ] Update `docs/ui/empty-state-quick-create.md` (the EP-6-owned reference) with the entity → slug map under "Context disambiguation".

## Phase 7 — Deploy

- [ ] After local smoke is green, push the branch and deploy frontend via `vercel --prod`.

## Exempt (kept as-is, with reason)

- **Enum status filters** (`status: draft|sent|paid`, `currency_code: IQD|USD`) — these have no "+ Add" semantics.
- **Hard-coded source/stage lists** in `CRMLeads.tsx` (lead source, lead stage) — these come from a config table, not a CRUD entity; tracked separately if/when stages move to a managed collection.
- **`<UserSelect>` and other already-wrapped pickers** — they own their own creation path and permission model.
- **Vertical-specific selectors** (e.g. `patient_id` in healthcare) — out of scope per requirements; tracked in a future vertical spec.

## Risks & mitigations

| Risk                                                  | Mitigation                                                                 |
|-------------------------------------------------------|----------------------------------------------------------------------------|
| Parent `useState`/`useEffect` fetch deletion breaks a sibling consumer | Audit each file before deletion; keep the fetch when another widget still reads the array. |
| A registry entry's `apiCreate` returns a shape the page does not expect | The contract is `{ id, label, raw }`; the page reads only `id`, so any shape works. |
| Stale options after quick-create when another tab adds a record | Out of scope — same behaviour as today; the registry does optimistic prepend, not server reconciliation. |
| RTL / Kurdish copy missing for a new CTA              | All 75 entity-scoped i18n keys shipped in EP-0; no new copy needed. |
