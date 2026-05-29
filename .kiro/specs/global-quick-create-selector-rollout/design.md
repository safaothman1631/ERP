# Global Quick-Create Selector Rollout — Design

## Migration pattern (the single recipe)

For every in-scope selector, perform this exact three-step
replacement. The pattern is identical regardless of entity, surface
(form / modal / table row / drawer), or width.

### Step 1 — Add the import

At the bottom of the existing design-system import block:

```ts
import { SelectWithQuickCreate } from '../design-system/empty/SelectWithQuickCreate';
```

Path is relative — adjust depth (`../` vs `../../`) for nested
folders. Never alias to `@/design-system` unless the file already
uses that alias; mixing styles inflates the diff.

### Step 2 — Replace the JSX

| Before                                                   | After                                                                 |
|----------------------------------------------------------|-----------------------------------------------------------------------|
| `<Select showSearch optionFilterProp="label" options={contacts.map(...)} placeholder={t('placeholder_customer')} allowClear />` | `<SelectWithQuickCreate entity="customer" showSearch placeholder={t('placeholder_customer')} allowClear />` |

The component owns:
- option loading (registry's `loadOptions`),
- empty state (`notFoundContent`),
- modal / drawer mount + telemetry,
- optimistic merge after save.

The call site only owns:
- `value` / `onChange` (unchanged),
- `disabled`, `style`, `placeholder`, `allowClear`,
- the surrounding `<Form.Item>` wrapper (unchanged).

### Step 3 — Drop the dead state

If the parent component has a `useState<[]>` plus `useEffect`
fetching the entity collection only to feed the `<Select>` options,
**delete both** along with the fetch helper (`useListQuery` or raw
`api.get`). `SelectWithQuickCreate` does its own loading, so the
parent fetch becomes dead code; keeping it doubles the network call
and re-introduces stale data.

The only case to keep parent-side fetching is when **another widget
on the same page consumes the same array** (e.g. a row renderer
shows `items.find(i => i.id === line.item_id).name`). In that case,
keep the parent fetch but mark with a `// also consumed by row
renderer` comment.

## Entity → slug map

| Field in form                       | Registry slug         |
|-------------------------------------|-----------------------|
| `contact_id` (customer context)     | `customer`            |
| `contact_id` (vendor context)       | `vendor`              |
| `customer_id`                       | `customer`            |
| `vendor_id`                         | `vendor`              |
| `item_id`                           | `item`                |
| `account_id`                        | `account`             |
| `bank_account_id`                   | `bank_account`        |
| `tax_id` / `tax_rate_id`            | `tax_rate`            |
| `currency_id` (rare; mostly `currency_code` which is enum) | `currency` |
| `tag_id` / `tags`                   | `tag`                 |
| `payment_method_id`                 | `payment_method`      |
| `expense_category_id`               | `expense_category`    |
| `equipment_category_id`             | `equipment_category`  |
| `team_id`                           | `team`                |
| `subscription_plan_id` / `plan_id`  | `subscription_plan`   |
| `location_id`                       | `location`            |
| `warehouse_id`                      | `location` (alias — same physical entity) |
| `employee_id`                       | `employee`            |

### Context disambiguation: `contact_id`

`contact_id` is overloaded between customer and vendor surfaces.
Use the **surrounding context**, not the field name, to pick the
slug:

- Invoices, sales orders, quotes, credit notes, sales receipts →
  `customer`.
- Bills, purchase orders, vendor credits, expenses (when paid to a
  vendor) → `vendor`.
- Generic CRM tables, contact directory → `customer` (fallback).

## Edge cases

### 1. Table-cell selects (`<td><Select .../></td>`)

Identical migration. `SelectWithQuickCreate` accepts the same
`style={{ width: 180 }}` plus an explicit `allowClear` prop. The
inline modal/drawer mounts at body level (portal), so table-cell
positioning does not clip it.

### 2. Multi-select (`mode="multiple"`)

`SelectWithQuickCreate` forwards `mode` to the underlying Antd
Select. Quick-create still produces a single record and appends to
the selected array. No registry change required.

### 3. Cascading selects

E.g. `account_id` filtered by `account_type`. Use the existing
`filterOption` or pre-filter on `loadOptions`. The registry's
`loadOptions` accepts a `filter` argument (see EP-0 design.md §4.1
fallback). Pass via the `loadOptions` prop on
`<SelectWithQuickCreate>`.

### 4. Already wrapped (e.g. `<UserSelect>`)

If the selector already wraps its own creation flow, document the
file in `tasks.md` under "Exempt" with the reason. Do **not** rip it
out — those widgets often carry permission logic the registry does
not yet model.

### 5. Warehouse vs Location

`warehouse_id` is a synonym for `location_id` in this codebase. Use
`entity="location"` for both. Future work: rename the API field if
desired, but out of scope here.

### 6. Read-only / disabled state

`SelectWithQuickCreate` accepts `disabled={true}`. When disabled,
both the trigger and the CTA inside the dropdown are unreachable —
no extra wiring needed.

### 7. SSR / non-DOM environments

Vitest tests that render forms in jsdom: the component renders fine;
mock `api` requests in the test setup. No changes to test infra.

## Telemetry

Every migrated selector now emits the EP-0 RUM events via
`useEmptyStateTelemetry`. Two events worth knowing:

| Event                       | When                                              |
|-----------------------------|---------------------------------------------------|
| `empty_state.cta_click`     | User clicked "+ Add `<entity>`" inside dropdown   |
| `empty_state.save_success`  | Quick-create modal saved successfully             |

No call-site code is needed — the component fires these from the
registry-driven path.

## Permission gating

Each registry entry has a `permission` string (e.g.
`"contacts.create"`). `SelectWithQuickCreate` calls
`usePermission(permission)` and hides the CTA when the user lacks
it. Call sites do not need a manual gate.

For pages that already disable the entire form via a wrapper guard
(e.g. `<RequirePermission>`), the new dropdown remains usable for
*selecting* even if creating is blocked — same as before.

## Bundle-size budget

Each call site is roughly:
- Add: one `import` line (~0.05 KB).
- Replace: `<Select ...>` (~0.2 KB JSX) → `<SelectWithQuickCreate ...>` (~0.15 KB JSX).
- Drop: an unused `useState` + `useEffect` (~0.4 KB, **negative** delta).

Net per page: **~−0.4 KB**. The EmptyState shell is shared and
already in the initial bundle, so no new chunk loads.

## Migration order (sequenced by user impact)

1. **Bills & expense flows** — already partially done; finish
   `Bills.tsx`, `Expenses.tsx`. Highest daily click count.
2. **Sales flows** — `RecurringInvoices.tsx`, `SalesOrders.tsx`,
   `CreditNotes.tsx` customer field.
3. **Inventory / operations** — `Inventory.tsx`, `MfgBOMs.tsx`,
   `Warehouses.tsx`.
4. **Configuration** — `BankRules.tsx`, `Projects.tsx`.

Each phase is independent; failures in phase 3 do not block phase 1
landing.

## Rollback

The migration is a pure JSX replacement with no schema or API
changes. Rollback per page is a `git revert` of that page's commit.
The component itself (`SelectWithQuickCreate`) is not modified by
this spec — it shipped in EP-0 and continues to work for the
already-migrated 25+ pages.

## CI / lint enforcement

After completion, `tools/eslint-rules/quick-create-select.js` is
extended (one-line addition) to include any new entity slug
introduced by this spec. The ratchet workflow blocks future
regressions by diffing `audit/empty-state-baseline.json`.
