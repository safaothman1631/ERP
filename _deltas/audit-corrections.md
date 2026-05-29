# Audit corrections — empty-state-quick-create

> Owner: EP-FINAL Reconciliation Specialist
> Date: 2026-05-28

This document records cases where the original surface audit
(`_deltas/empty-state-audit.md`) mismatched the codebase. No code fix is
required for these entries; they exist so the next baseline run does not
chase ghosts.

## Subforms — five audit entries removed

EP-5 was tasked with migrating repeating-row subforms in the following
files. Inspection showed none of them contain repeating Form sections
(`Form.List` / `useFieldArray` / inline editable tables). They are all flat
single-record forms inside a `FormDialog`.

| Audit-listed file | Real structure | Migration verdict |
|-------------------|----------------|-------------------|
| `frontend/src/pages/restaurant/MenuManager.tsx` | Flat menu-item form; parent list is a `ResponsiveTableAdapter`, not a subform. | **Out of scope — no repeating section.** |
| `frontend/src/pages/quality/QCPlans.tsx` | Flat QC-plan form; no "check items" subform. | **Out of scope — no repeating section.** |
| `frontend/src/pages/maintenance/MaintenanceSchedules.tsx` | Flat schedule form; no task subform. | **Out of scope — no repeating section.** |
| `frontend/src/pages/hospital/WardsAdmissions.tsx` | Two separate flat forms inside one Tabs page. No procedures subform. | **Out of scope — no repeating section.** |
| `frontend/src/pages/PayrollRules.tsx` | Flat rule form (code/name/type/amount/etc.). No conditions subform. | **Out of scope — no repeating section.** |

### Recommendation for the next audit pass

Future `scripts/audit-empty-states.mjs` runs should AST-grep for
`Form.List` / `useFieldArray` rather than treating the audit list as
authoritative. The five files above should appear in the script's
`skipped` bucket, not the `pending` bucket.

## ExpenseForm category selector — does not exist

EP-2 was asked to migrate an `expense_category` selector on
`frontend/src/pages/ExpenseForm.tsx`. The form has no `category_id` field —
expenses are categorised through `account_id` instead. Product/data-model
question for a future PR: should an explicit expense category selector be
added?

## Rental / Repair / IoT — free-text fields, not FKs

| File | Field the audit named | Real schema |
|------|-----------------------|-------------|
| `pages/rental/RentalContracts.tsx` | `customer_id` | Free-text `customer_name` string |
| `pages/repairs/RepairOrders.tsx` | `customer_id` | Free-text `customer_name` string |
| `pages/iot/IoTDevices.tsx` | `location_id` | Free-text `location` string |

Converting these to FK selectors would require a schema migration on the
backend models. Tracked as a product/data-model discussion, not an EP
migration ticket.

## BillForm `item_id` — does not exist

EP-1's Rank-6 audit entry pointed at `BillForm.tsx`'s `item_id`. The form
uses `{description, quantity, rate, account_id, tax_id}` — no per-line
item reference. The closest analog is the line-item `account_id`
selector, which is a separate registry entry (`account`, Class B).

## WorkflowsList `trigger_event`

EP-2 skipped this selector. Triggers are system-defined, fetched from
`/api/automation/triggers`, and not user-creatable. The registry should
not add a `workflow_trigger` entity.
