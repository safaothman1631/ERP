# EP-2 Long-Tail Migration — Summary

> **Phase:** EP-2 — Class A long-tail (Week 3-4)
> **Owner:** EP-2 agent
> **Spec:** `.kiro/specs/empty-state-quick-create/tasks.md`
> **Contract API:** `<SelectWithQuickCreate entity="..." />` from `@/design-system/empty/SelectWithQuickCreate`

---

## Migration table

| # | File | Selector | Entity | Status | Notes |
|---|------|----------|--------|--------|-------|
| 1 | `frontend/src/pages/ExpenseForm.tsx` | `category_id` | `expense_category` | **SKIPPED** | Audit was wrong — the form has no `category_id` field. It has `account_id`, `contact_id` (vendor), `project_id`, and `tax_id` only. Expense category is not modeled here. EP-6 should re-audit. |
| 2 | `frontend/src/pages/ItemForm.tsx` | `income_account_id` | `account` | **DONE** | Replaced `<Select>` with `<SelectWithQuickCreate entity="account" />`. Removed unused `accounts` state, `AccountOption` type, and `/api/accounts` fetch. |
| 3 | `frontend/src/pages/ItemForm.tsx` | `expense_account_id` | `account` | **DONE** | Same change as income_account_id; both share the registry-driven option source. Also cleaned residual `taxes` state from prior EP-1 migration (T-E.1.6 left it). |
| 4 | `frontend/src/pages/BankReconciliation.tsx` | `selectedAccount` Select | `bank_account` | **DONE** | Replaced top-of-page account picker (`/api/banking/accounts`). Removed `accounts` state, fetch `useEffect`, and now-unused `useEffect` import. Preserved `value`/`onChange`/`style`/`placeholder`. |
| 5 | `frontend/src/pages/subscriptions/SubscriptionsList.tsx` | `contact_id` (form drawer) | `customer` | **DONE (with upgrade)** | The audit said "Select" but the field was actually an `<Input>` (free-text UUID — bad UX). Converted to `<SelectWithQuickCreate entity="customer" />` — same string value via onChange. |
| 6 | `frontend/src/pages/subscriptions/SubscriptionsList.tsx` | `plan_id` (form drawer) | `subscription_plan` | **DONE** | Replaced `<Select>` populated from `plans` state. `plans` state retained because it's still used by the column renderer and the plan filter. |
| 7 | `frontend/src/pages/rental/RentalContracts.tsx` (+ Detail) | `customer_id` | `customer` | **SKIPPED** | Audit was wrong — Rental uses a free-text `customer_name` (string), not a `customer_id` FK. Converting would change the data model. RepairOrderDetail also has no customer_id. Flag for backend/spec discussion: should rental contracts link to contacts? |
| 8 | `frontend/src/pages/repairs/RepairOrders.tsx` (+ Detail) | `customer_id` | `customer` | **SKIPPED** | Same as rental — uses a free-text `customer_name` (string), no `customer_id` FK. Detail page does not contain `customer_id` either. Flag for backend/spec discussion. |
| 9 | `frontend/src/pages/iot/IoTDevices.tsx` | `location_id` | `location` | **SKIPPED** | The IoT device model has a free-text `location` string (Input), not a `location_id` FK. Migration would require schema changes. Flag for backend discussion. |
| 10 | `frontend/src/pages/maintenance/Equipment.tsx` | `category_id` (in form) | `equipment_category` | **DONE** | Replaced the in-form category Select with `<SelectWithQuickCreate entity="equipment_category" />`. The top-of-page category filter still uses raw `<Select>` populated from `categories` state — this is a *filter*, not a form field; keeping it as-is per scope. |
| 11 | `frontend/src/pages/multi-entity/CompaniesList.tsx` | `currency` | `currency` | **DONE** | Replaced the hardcoded IQD/USD/EUR `<Select>` with `<SelectWithQuickCreate entity="currency" />`. Now uses the registry — quick-create will let users add new currencies as needed. Removed `Select` from antd import. |
| 12 | `frontend/src/pages/automation/WorkflowsList.tsx` | `trigger_event` | `workflow_trigger` | **SKIPPED** | Per contract: `workflow_trigger` is not in the registry. EP-6 may add. Trigger events come from `/api/automation/triggers` and are system-defined — they may not need user quick-create at all. |

---

## Totals

- **Selectors migrated:** **6** (ItemForm × 2, BankReconciliation × 1, SubscriptionsList × 2, Equipment × 1, CompaniesList × 1)
- **Files modified:** **5** (ItemForm.tsx, BankReconciliation.tsx, SubscriptionsList.tsx, Equipment.tsx, CompaniesList.tsx)
- **Skipped:** **6** (ExpenseForm, Rental, Repair, IoT, Workflow — 5 unique files; 6 entity entries because Rental+Repair listed separately for customer_id)

---

## Entities referenced (must exist in `quickCreateRegistry.ts` for EP-0)

These entity slugs are now hard-referenced by EP-2 migrations and must be present in the EP-0 registry:

| Entity slug | Class (from design.md §2) | Used in |
|-------------|---------------------------|---------|
| `account` | B | ItemForm (income/expense) |
| `bank_account` | B | BankReconciliation |
| `customer` | A | SubscriptionsList (contact_id) |
| `subscription_plan` | B | SubscriptionsList (plan_id) |
| `equipment_category` | A | Equipment |
| `currency` | A | CompaniesList |

All six are in the EP-0 seed list per `design.md §2.1`. No new registry work is required from EP-0 to support EP-2.

---

## Entities that may need new registry entries (pass to EP-0 / EP-6)

- **`workflow_trigger`** — referenced by WorkflowsList trigger_event. Currently outside scope; might not be needed if triggers stay system-defined.

---

## Schema mismatches discovered (flag for backend / product)

These selectors were in the audit but the underlying data model uses free-text strings rather than foreign keys:

1. **Rental contracts** (`customer_name`) — should this be `customer_id` FK to `contacts`?
2. **Repair orders** (`customer_name`) — same question.
3. **IoT devices** (`location` string) — should this be `location_id` FK?
4. **ExpenseForm** — no `category_id` at all; expenses are categorized by `account_id`. Is "expense category" a separate concept the form should expose?

These are product/data-model questions, not EP-2 migration work. Document and pass upstream.

---

## Confidence ratings (per migration)

| Migration | Confidence | Reason |
|-----------|-----------|--------|
| ItemForm — income_account_id | High | Direct 1:1 replacement; preserved Form.Item shape and placeholder. |
| ItemForm — expense_account_id | High | Same as above. |
| BankReconciliation | High | Preserved value/onChange/style/placeholder; cleaned `useEffect` import. |
| SubscriptionsList — contact_id | Medium | Was an `<Input>`, not a Select — I converted it. Semantics preserved (still a string value via onChange), but if backend rejects a non-UUID it would still reject; the UX is the win. |
| SubscriptionsList — plan_id | High | Direct 1:1 replacement; kept `plans` state for filter + column. |
| Equipment — category_id | High | Direct 1:1 replacement; kept `categories` state for filter + column. |
| CompaniesList — currency | Medium | Replaced 3 hardcoded options with registry-driven Select. Behavior depends on EP-0 currency entity returning the correct shape. If the registry expects currency codes as values, this works. |
| Skips (5 files) | High confidence in the skip decision | Audit clearly didn't match the file structure. |

---

## Constraint compliance

- ✅ Did **NOT** modify `design-system/empty/`, `quickCreateRegistry.ts`, `package.json`, or anything outside the migration file list.
- ✅ Re-read every file after Edit to detect truncation.
- ✅ Preserved all props on the replaced Selects (value, onChange, placeholder, style, allowClear where appropriate).
- ✅ Removed now-unused option-loading code (useEffect calls and useState for the deleted Selects).
- ✅ Did not touch filter Selects or column-rendering data — only form selectors per contract.

---

## Dependency on EP-0

All edits import from `@/design-system/empty/SelectWithQuickCreate`. At the time of this writing:

- `frontend/src/design-system/empty/` directory **does NOT exist** in the codebase.
- `frontend/src/data/quickCreateRegistry.ts` **does NOT exist**.

These are EP-0's deliverables. **EP-2's code will not compile until EP-0 lands.** This is expected per the phased rollout.

---

## Suggested next actions

1. **EP-0:** Ensure registry seeds include `account`, `bank_account`, `subscription_plan`, `equipment_category`, `currency` (and the existing `customer`).
2. **EP-3:** Address the Class B drawer entities — `account`, `bank_account`, `subscription_plan` are all Class B per design.md §2.1. Their drawers must exist before EP-2's edits become user-visible.
3. **EP-6:** Re-audit the skipped files. If product wants customer linkage in Rental/Repair, a schema migration ticket is needed first.
4. **Spec maintainer:** Re-confirm or remove the audit entries for ExpenseForm `category_id`, Rental `customer_id`, Repair `customer_id`, IoT `location_id` — these don't match the implementation today.
