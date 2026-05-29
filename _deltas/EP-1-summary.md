# EP-1 — Top-7 Selector Migration Summary

> **Spec:** `empty-state-quick-create` (Phase EP-1)
> **Owner:** EP-1 Selector Migration Specialist
> **Date:** 2026-05-28

This delta migrates the top-7 highest-traffic API-driven `<Select>` selectors to
the new `<SelectWithQuickCreate>` HOC produced by EP-0. The HOC is imported via
relative path `../design-system/empty/SelectWithQuickCreate` (the project does
not declare a `@/` TS path alias — see `frontend/tsconfig.app.json`).

---

## Per-file change log

### 1) `frontend/src/pages/InvoiceForm.tsx` (Ranks 1 + 2)

- **Selectors migrated:**
  - `contact_id` (customer) — line 102 → `<SelectWithQuickCreate entity="customer" />`.
  - line-item `item_id` — line ~138 → `<SelectWithQuickCreate entity="item" />`.
- **Removed imports/state:**
  - Removed `Select` from the `antd` named imports (no longer used directly).
  - Removed `const [contacts, setContacts] = useState<any[]>([])` and the matching `/api/contacts` fetch in `useEffect`.
- **Retained imports/state:**
  - `items` state and its `/api/items` fetch are *kept*: `updateLine` consumes the item record to autofill `description` and `unit_price` on line selection. The HOC owns option rendering; the local cache only powers the side-effect after a row's `item_id` changes. A future iteration could pull this from the HOC's `onChange` payload to eliminate the duplicate fetch.
- **Lines changed:** ~24 changed / ~5 added / ~4 deleted.
- **Confidence:** **High** — direct prop replacement, no surrounding refactor.

### 2) `frontend/src/pages/QuoteForm.tsx` (Ranks 3 + 4)

- **Selectors migrated:**
  - `contact_id` (customer) → `<SelectWithQuickCreate entity="customer" />`.
  - line-item `item_id` → `<SelectWithQuickCreate entity="item" />`.
- **Removed:** local `contacts` state and `/api/contacts` fetch; `Select` named import.
- **Retained:** local `items` state for the same autofill side-effect described above.
- **Lines changed:** ~24 changed / ~5 added / ~4 deleted.
- **Confidence:** **High** — symmetric with InvoiceForm.

### 3) `frontend/src/pages/BillForm.tsx` (Rank 5; Rank 6 deferred)

- **Selectors migrated:**
  - `contact_id` (vendor) → `<SelectWithQuickCreate entity="vendor" />` (Rank 5).
- **Removed:** `vendors` state and the `/api/contacts?contact_type=vendor` fetch.
- **Retained:** `Select` import (still used for line-item account + tax selectors), local `accounts` + `taxes` state.
- **Rank 6 (BillForm item_id) NOT migrated** — see "Issues discovered" below.
- **Lines changed:** ~12 changed / ~5 added / ~6 deleted.
- **Confidence:** **High** for vendor; **N/A** for Rank 6.

### 4) `frontend/src/pages/ItemForm.tsx` (Rank 7)

- **Selectors migrated:**
  - `tax_id` → `<SelectWithQuickCreate entity="tax_rate" />` (Rank 7).
- **Already migrated by another agent (out of my scope, observed only):**
  - `income_account_id` and `expense_account_id` were already using `<SelectWithQuickCreate entity="account" />` when I opened the file. I did not modify these.
- **Removed:** `taxes` state, the `TaxOption` interface, the `/api/taxes/rates` fetch, the `ApiListResponse` + `toList` helpers (no longer referenced after both the tax and account state were eliminated).
- **Retained:** `Select` import — still used for the static `item_type` select (goods/service, not API-driven).
- **Lines changed:** ~15 changed / ~5 added / ~15 deleted (mostly the dead helper types).
- **Confidence:** **High** for tax migration. **Note (medium confidence)** on the cleanup: removed `ApiListResponse`/`toList` because they had become unreferenced — verify on the next build that no other file imports them from `ItemForm.tsx` (they were locally scoped, so this should be safe).

### 5) `frontend/tests/e2e/quick-create.spec.ts` *(new file)*

- New Playwright spec covering 3 scenarios per migrated selector:
  1. Empty state + CTA visible when collection is empty.
  2. CTA opens the modal/drawer → submit → auto-selects new record.
  3. Cancel modal/drawer → form remains untouched.
- Guarded behind `RUN_QUICK_CREATE_E2E=1` so it doesn't break CI before EP-0's HOC is fully wired.
- Stubs `/api/contacts`, `/api/items`, `/api/taxes` GET responses to deterministically force the empty state.
- **Confidence:** **Medium** — locator strategies (placeholders matching the i18n key names like `placeholder_customer`, `label:has-text("items")`) assume the i18n bundle hasn't translated the keys at test time, OR that the keys themselves render literally. Once EP-0 lands and i18n is finalised, the locators may need tightening to use `data-testid` instead. The test file's structure and assertions are sound; only the selectors are brittle.

---

## Issues discovered (flagged for follow-up)

### 1. Rank 6 — "BillForm item_id Select" does not exist

The audit's Rank 6 says: migrate the `item_id` Select in `BillForm.tsx`. **There is no `item_id` selector in `BillForm.tsx`.** Bill line items use `{description, quantity, rate, account_id, tax_id}` — no per-line item reference. The closest analog is the per-line `account_id` selector, but that's an *account*, not an *item*. I did not migrate it because:
- The task brief explicitly limits me to the 4 form files and one new test file, with line-item `account_id` migration out of scope for EP-1.
- Confusing "item" vs "account" risks selecting the wrong registry entry.

**Recommendation:** the audit's `_deltas/empty-state-audit.md §8` rank list should be corrected. Either drop Rank 6 (BillForm doesn't have an item selector), or reclassify it as `BillForm.account_id` (line-item account selector) and schedule it for EP-3 alongside the other account migrations.

### 2. ItemForm tax endpoint mismatch

`ItemForm.tsx` was originally fetching `/api/taxes/rates`, while `BillForm.tsx` fetches `/api/taxes`. The new `tax_rate` registry entry needs to use *one* canonical endpoint. EP-0 should confirm which is correct (or whether they're aliases). If the registry's `loadOptions` hits a different endpoint than the backend currently exposes for tax rates on the items screen, the dropdown will appear empty even when taxes exist.

### 3. Line-item enrichment dependency on local item cache

Both `InvoiceForm.tsx` and `QuoteForm.tsx` retain a local `items` array because `updateLine` reads the selected item to populate `description` and `unit_price`. The HOC currently has no API to expose the raw record on change. Two options:

- (a) Extend `SelectWithQuickCreate`'s `onChange` signature with the full record (e.g., `(value, record) => void`).
- (b) Move the autofill side-effect into the form's submit/render pipeline by fetching the record on demand.

Until either lands, the duplicate fetch remains. Low priority but worth flagging.

### 4. Pre-existing migration in ItemForm

`ItemForm.tsx`'s two account selectors (`income_account_id`, `expense_account_id`) were already migrated to `<SelectWithQuickCreate entity="account" />` when I opened the file — presumably by a parallel agent or earlier work. I did not touch those edits; my changes only address `tax_id`. If the parallel work is unintentional, EP-0 should reconcile.

---

## Items for EP-0 to confirm or extend

1. **Registry entry: `tax_rate`** — confirm canonical endpoint (`/api/taxes` vs `/api/taxes/rates`) and field schema.
2. **Registry entry: `vendor`** — confirm it reuses the `contact` endpoint with `contact_type='vendor'` default per the spec; the migration assumes this.
3. **HOC `onChange` payload** — consider widening to `(value, fullRecord)` so consumers (line-item autofill) can drop their local caches.
4. **`data-testid="empty-state-cta-selector"`** — the design doc §1.1 names this testid. Tests rely on it; please keep it stable.
5. **Path alias** — the spec text says `import { SelectWithQuickCreate } from '@/design-system/empty/SelectWithQuickCreate'`, but the project has no `@/` TS path alias. I used `../design-system/empty/SelectWithQuickCreate`. Either add the alias to `tsconfig.app.json` + `vite.config.ts`, or update the spec to use relative paths.

---

## Confidence summary

| Rank | File | Selector | Confidence |
|-----:|------|----------|:----------:|
| 1 | InvoiceForm | customer_id | High |
| 2 | InvoiceForm | line item_id | High |
| 3 | QuoteForm   | contact_id | High |
| 4 | QuoteForm   | line item_id | High |
| 5 | BillForm    | vendor (contact_id) | High |
| 6 | BillForm    | item_id | **N/A — selector does not exist (audit error)** |
| 7 | ItemForm    | tax_id  | High |
| —  | Playwright spec | quick-create.spec.ts | Medium (locator brittleness) |

---

## Files modified

- `frontend/src/pages/InvoiceForm.tsx`
- `frontend/src/pages/QuoteForm.tsx`
- `frontend/src/pages/BillForm.tsx`
- `frontend/src/pages/ItemForm.tsx`
- `frontend/tests/e2e/quick-create.spec.ts` (new)

## Files NOT modified (per scope constraint)

- Anything under `frontend/src/design-system/empty/` — owned by EP-0.
- `frontend/src/data/quickCreateRegistry.ts` — owned by EP-0.
- `package.json`, `vite.config.ts`, `App.tsx`, `main.tsx`.
- Any other form file outside the four listed above.
