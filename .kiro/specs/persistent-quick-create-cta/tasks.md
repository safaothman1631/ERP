# Persistent Quick-Create CTA — Tasks

> One concrete checklist item per file touched or check performed.
> Mark `[x]` as completed.

## Phase 0 — Pre-flight

- [x] Confirm Antd version supports `popupRender` (Antd 6.3.5 — verified `dropdownRender?: SelectProps['popupRender']`).
- [x] Audit all `SelectWithQuickCreate` call sites (32 files, 58 usages — captured 2026-05-28).
- [x] Confirm zero raw `<Select>` with entity options remains in `pages/` (global-quick-create-selector-rollout cleared them).
- [x] Confirm permission hook (`usePermission`) is available and used by the body CTA today.

## Phase 1 — Component change

- [x] **`frontend/src/design-system/empty/SelectWithQuickCreate.tsx`**
  - [x] Switch `dropdownRender` → `popupRender` (removes the Antd 6 deprecation warning).
  - [x] Introduce a co-located `popupRender` callback that owns the state-switch body + persistent footer.
  - [x] Introduce a co-located `QuickCreateFooter` sub-component (plain `<button>`, not Antd `<Button>`, for predictable focus inside the popup).
  - [x] Remove the inline `primaryAction` from the empty state (`<EmptyState>`'s body) — the footer is the canonical single create entry point.
  - [x] Keep the search-empty body's "Clear search" action; the footer remains visible alongside it.
  - [x] Compute `footerVisible = v2Enabled && config && canCreate && !disabled` (per-entity override + permission + disabled gating).
  - [x] Pass an additional `source: 'footer' | 'body'` field to the `cta_click` telemetry event.
  - [x] Public type `SelectWithQuickCreateProps` unchanged so the 58 call sites compile untouched.

- [x] **`frontend/src/design-system/empty/EmptyState.css`**
  - [x] Add the `.qc-select-footer` and `.qc-select-footer__cta` rules (see design §"Styling").
  - [x] Include `:hover`, `:focus-visible`, `:active` rules.
  - [x] Define `--qc-border-subtle` and `--qc-surface-elevated` token fallbacks so the rule works without the AntD ConfigProvider.

## Phase 2 — Tests

- [ ] **`frontend/src/design-system/empty/SelectWithQuickCreate.test.tsx`** (create if missing)
  - [ ] Render with non-empty options → assert footer is in the document.
  - [ ] Render with empty options → assert empty body renders WITHOUT inline CTA and footer IS visible.
  - [ ] Render with `disabled` → assert footer is NOT in the document.
  - [ ] Render with permission denied (mock `usePermission` → `false`) → assert footer is NOT in the document.
  - [ ] Click footer → assert the modal/drawer mount handler fires AND a `cta_click` telemetry event is recorded with `source: 'footer'`.
  - [ ] Render with `ctaOverride` → assert the override label appears in the footer (not the registry default).
  - [ ] Mock RTL via `<ConfigProvider direction="rtl">` → assert footer renders without throwing.

## Phase 3 — Type & lint

- [ ] Run `npx tsc --noEmit -p tsconfig.app.json` in `frontend/` and confirm zero new errors introduced by the change.
- [ ] Run `npm run lint -- frontend/src/design-system/empty` and confirm no new violations.
- [ ] Confirm the `tools/eslint-rules/quick-create-select.js` rule still reports zero violations across `frontend/src` (the call sites are unchanged).

## Phase 4 — Manual smoke (local dev server)

> Each page below has a known dropdown using a registry entity. Open the dropdown and confirm the footer renders with the correct label. Save a record from the footer and confirm it is selected.

- [ ] `pages/Bills.tsx` — Vendor + Account
- [ ] `pages/BillForm.tsx` — Vendor (Class A)
- [ ] `pages/Quotes.tsx` / `pages/QuoteForm.tsx` — Customer + Item lines
- [ ] `pages/InvoiceForm.tsx` — Customer + Item lines
- [ ] `pages/PurchaseOrders.tsx` — Vendor + Item lines
- [ ] `pages/SalesOrders.tsx` — Customer + Item lines
- [ ] `pages/RecurringInvoices.tsx` — Customer + Item lines
- [ ] `pages/CreditNotes.tsx` — Customer + Item lines
- [ ] `pages/VendorCredits.tsx` — Vendor + Item lines
- [ ] `pages/Bills.tsx` (Class A vendor modal save → auto-select)
- [ ] `pages/Expenses.tsx` — Account
- [ ] `pages/ExpenseForm.tsx` — Vendor
- [ ] `pages/Inventory.tsx` — Item + Account
- [ ] `pages/MfgBOMs.tsx` — Item (product)
- [ ] `pages/Warehouses.tsx` — Location (from/to)
- [ ] `pages/BankRules.tsx` — Account + Contact
- [ ] `pages/BankReconciliation.tsx` — Bank account
- [ ] `pages/Projects.tsx` — Customer
- [ ] `pages/ItemForm.tsx` — Tax rate / Category
- [ ] `pages/CycleCounts.tsx` — Item / Location
- [ ] `pages/PutawayRules.tsx` — Item / Location
- [ ] `pages/Assets.tsx` — Account (×3 in fixed-asset form)
- [ ] `pages/helpdesk/TicketsList.tsx` — Contact / Team
- [ ] `pages/maintenance/Equipment.tsx` — Equipment category
- [ ] `pages/multi-entity/CompaniesList.tsx` — Currency
- [ ] `pages/subscriptions/SubscriptionsList.tsx` — Customer / Plan
- [ ] `settings/sections/bodies.tsx` — Any embedded SelectWithQuickCreate

## Phase 5 — Cross-cutting smoke

- [ ] Confirm no `dropdownRender` deprecation warning remains in the browser console after a hard refresh.
- [ ] Confirm no new console errors on any of the smoked pages.
- [ ] Confirm RTL renders correctly (switch language to Kurdish; open one dropdown of each entity class).
- [ ] Confirm telemetry: open RUM dev panel (if available) or check the network for `/api/rum/events` POSTs — assert `cta_click` with `source: 'footer'` on footer clicks.
- [ ] Confirm permission gate: log in as a role without `contacts.create` (if available) and verify Vendor / Customer dropdowns DO NOT show the footer.
- [ ] Confirm disabled state: render a `<SelectWithQuickCreate disabled />` in dev gallery → footer absent.

## Phase 6 — Audit + ratchet

- [ ] Run `npm run audit:empty-states` and confirm baseline still passes (the audit script inspects EmptyState usage; the body change should be a no-op for it).
- [ ] If the audit script emits a baseline diff, commit the updated `audit/empty-state-baseline.json` in the same PR.
- [ ] Update `_deltas/empty-state-final-state.md` with a one-line note about the persistent CTA upgrade.

## Phase 7 — Commit & deploy

- [ ] Commit the change with subject `feat(select-with-quick-create): persistent footer CTA in every dropdown state`.
- [ ] Push to `feat/platform-overhaul-2026-05-27` (already open as PR #1).
- [ ] Frontend deploy via `vercel --prod` after smoke is green.
- [ ] Backend is unaffected — no backend redeploy required.

## Exempt

- **`UserSelect` / `ContactPicker` in `ChatterPanel.tsx`** — own their own creation flow, out of scope.
- **Raw Antd `<Select>` for enums** (status filters, currency_code dropdowns, lead-source pickers) — no create semantics, by spec excluded.

## Risks revisited

| Risk                                                  | Concrete mitigation in this slice |
|-------------------------------------------------------|-----------------------------------|
| Antd 6 `popupRender` clips footer in virtualized lists | Manual smoke explicitly opens a dropdown with > 30 options (Items in an Invoice form) and scrolls. |
| Telemetry overcount from old + new CTA paths          | Inline empty-state `primaryAction` is REMOVED (R5). Only the footer fires. |
| Per-entity emergency disable                          | `isEmptyStateV2Enabled(entity)` is kept as the footerVisible gate. |
| Vitest cannot open Antd popup                         | Tests use `fireEvent.mouseDown` on the selector first, then assert on the popup contents (existing pattern in repo). |
