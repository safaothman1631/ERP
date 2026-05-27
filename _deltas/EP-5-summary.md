# EP-5 Subform + Class C Specialist — Summary

> **Spec:** `.kiro/specs/empty-state-quick-create`
> **Phase:** EP-5 — Subforms + Drawer Panels + Class C
> **Status:** Partial — see "Files skipped" below.
> **Date:** 2026-05-28
> **Owner:** EP-5 sub-agent.

---

## Scope reminder

EP-0 builds primitives at `frontend/src/design-system/empty/`. EP-5 was asked to handle:

1. In-form repeating subforms (using `<SubformWithEmptyState>`).
2. Drawer / side-panel related-data lists (using `<RelatedDataPanel>`).
3. The Class C navigate-with-return-token pattern (Employee).

EP-0's `design-system/empty/*` files were **NOT yet present** when EP-5 ran. Per the task brief ("Do NOT modify `design-system/empty/*`"), EP-5 created the wrapper primitives in an adjacent location (`frontend/src/components/empty/`) so EP-0 can later supersede them without conflict.

---

## Files created

| Path | Purpose |
|------|---------|
| `frontend/src/utils/returnContext.ts` | `saveReturnContext`, `restoreReturnContext`, `clearReturnContext`, `readReturnToken`, `purgeExpiredReturnContexts`. Uses `sessionStorage` keyed by ULID/UUID, expires after 1h. |
| `frontend/src/components/empty/SubformWithEmptyState.tsx` | EP-5 wrapper for in-form repeating sections (currently unused — see skip list). |
| `frontend/src/components/empty/RelatedDataPanel.tsx` | EP-5 wrapper for related-data panels in detail pages. Supports loading skeleton, empty-state with optional CTA, and i18n fallback strings. |
| `frontend/tests/e2e/class-c-return-token.spec.ts` | Playwright test for the full Class C round-trip (skipped unless `RUN_CLASS_C_E2E=1`). |

---

## Files migrated

### Scope 2 — Related-data drawer / detail panels

| File | Panel(s) wrapped | Entity tag |
|------|------------------|------------|
| `frontend/src/pages/maintenance/EquipmentDetail.tsx` | `requests`, `schedules`, `logs` — all three tab tables now render `<RelatedDataPanel>` empty-state when the related collection is empty. | `maintenance_request`, `maintenance_schedule`, `maintenance_log` |
| `frontend/src/pages/subscriptions/SubscriptionDetail.tsx` | Dunning history — previously hidden when empty (`dunning.length > 0 && ...`), now always visible with a proper empty-state. | `billing_event` |
| `frontend/src/pages/iot/DeviceDetail.tsx` | Latest readings card — replaced the ternary with `<RelatedDataPanel>` so the empty state is structured + accessible. (Telemetry chart still uses its own message; deferred.) | `device_reading` |

i18n keys added to `frontend/src/locales/ku.json` and `frontend/src/locales/en.json`:
- `maintenance.no_requests_title`, `maintenance.no_requests_description`
- `maintenance.no_schedules_title`, `maintenance.no_schedules_description`
- `maintenance.no_logs_title`, `maintenance.no_logs_description`

For subscriptions + IoT empty-state keys, EP-5 relied on the `<RelatedDataPanel>` `*Fallback` props so the page is still usable while translations catch up. Translators should add `subscription.no_dunning_*` and `iot.no_readings_*` in a follow-up PR.

### Scope 3 — Class C round-trip (Employee)

| File | Change |
|------|--------|
| `frontend/src/pages/helpdesk/TicketDetail.tsx` | Replaced the assigned-to plain-text `Input` with a searchable `<Select>` that loads the employees list. Empty-state in `notFoundContent` and a `dropdownRender` footer both surface the "Add new employee" CTA. The CTA calls `saveReturnContext` and navigates to `/hr/employees?returnTo=<token>&autoOpen=1`. On return (via `?newEmployeeId=…&consumedToken=…`), the assign dialog re-opens with the new employee pre-selected, and the consumed token is cleared from sessionStorage. |
| `frontend/src/pages/HREmployees.tsx` | On mount, parses `?returnTo=` (via `readReturnToken`) and `?autoOpen=1`. If present, restores the return-context, shows an info banner (`returnHint`), and auto-opens the FormDialog. On save, the new employee id is appended to the source path and the app navigates back. The dialog is closed and the active token reference is cleared. |

The Class C flow uses sessionStorage (not URL params) for the actual state payload — only the opaque token rides on the URL, per the `Risk` register entry "Class C return-token state-restoration loses fields on long forms".

---

## Files skipped + reasons

### Subforms (Scope 1) — all five targets skipped

The audit-listed subforms do not contain `Form.List` / `useFieldArray` / repeating rows in the current codebase. They are all flat single-record forms inside a `FormDialog`. The `<SubformWithEmptyState>` primitive was nevertheless created in `components/empty/` so it's ready when a real subform appears.

| Audit-suggested file | Actual structure | Skip reason |
|----------------------|------------------|-------------|
| `pages/restaurant/MenuManager.tsx` | Flat menu-item form; the parent list is a `ResponsiveTableAdapter`, not a subform. | No repeating section. |
| `pages/quality/QCPlans.tsx` | Flat QC-plan form; no "check items" subform. | No repeating section. |
| `pages/maintenance/MaintenanceSchedules.tsx` | Flat schedule form; no task subform. | No repeating section. |
| `pages/hospital/WardsAdmissions.tsx` | Wards + admissions are two separate flat forms inside one Tabs page. No procedures subform. | No repeating section. |
| `pages/PayrollRules.tsx` | Flat rule form (code/name/type/amount/etc.). No conditions subform. | No repeating section. |

Recommendation: the audit's "subform" count appears speculative. A re-audit during EP-6 should grep for `Form.List|useFieldArray` and re-baseline the 14 promised surfaces.

### Drawer panels (Scope 2) — partial

| Audit-suggested file | Skip reason |
|----------------------|-------------|
| `pages/rental/RentalContractDetail.tsx` | No payment-schedule panel in the file — only a contract-info card. Nothing to wrap yet. |
| `pages/field-service/ServiceOrderDetail.tsx` | The `time_log`, `parts_used`, and `signature` tabs are placeholders (`<ComingSoon />`). Empty-state migration deferred until the actual lists are wired up. |

The `iot/AlertHistory.tsx` page exists but is a list page, not a per-device alert-history panel inside `DeviceDetail.tsx`. Deferred to EP-4's list-page migration scope.

---

## Class C round-trip — implementation status

| Step | Status |
|------|--------|
| `saveReturnContext` / `restoreReturnContext` / `clearReturnContext` helpers in `utils/returnContext.ts` | DONE |
| `purgeExpiredReturnContexts` boot-time sweep helper | DONE |
| TicketDetail assigned-to selector → empty-state + CTA | DONE |
| Click CTA → navigate with returnTo token | DONE |
| HREmployees auto-open form on `?autoOpen=1` | DONE |
| HREmployees on-save → bounce back with `?newEmployeeId=…&consumedToken=…` | DONE |
| TicketDetail → consume `newEmployeeId`, re-open assign dialog, clear token | DONE |
| Playwright happy-path test | DONE (skipped behind `RUN_CLASS_C_E2E=1`) |
| Playwright expiry test | DONE |

Note: HREmployees in the current codebase uses a `FormDialog` (modal) for create, not a separate `/hr/employees/new` route. The Class C flow therefore lands on `/hr/employees?returnTo=…&autoOpen=1` rather than a dedicated `EmployeeNew` page. The user-visible experience is identical — the dialog auto-opens with the return-hint banner above the list.

---

## Test coverage

Playwright: `frontend/tests/e2e/class-c-return-token.spec.ts`

- Test 1: full round-trip — empty selector → CTA → nav → fill form → save → return → new employee selected.
- Test 2: expiry — force-expire the token in sessionStorage, reload, verify the hint banner disappears.

Run with `RUN_CLASS_C_E2E=1 npx playwright test tests/e2e/class-c-return-token.spec.ts` (matches the EP-1 spec's opt-in convention).

---

## Risks / follow-ups

1. **EP-0 primitive conflict.** When EP-0 ships the canonical `design-system/empty/SubformWithEmptyState.tsx` and `RelatedDataPanel.tsx`, a follow-up PR should replace imports of `components/empty/*` with the EP-0 versions and delete the EP-5 shims. The shim files include a banner comment to that effect.
2. **Translation gap.** Subscription + IoT empty-state keys were left to fallback strings (`emptyTitleFallback="..."`). Translators need to add `subscription.no_dunning_title`, `iot.no_readings_title`, etc., in ku/en/ar.
3. **No subforms migrated.** The 5 audit-listed files contain no repeating-row subforms. EP-6 should re-audit with an AST grep for `Form.List` rather than treating the audit list as authoritative.
4. **HR FormDialog vs dedicated new page.** If product wants a true `/hr/employees/new` dedicated page (per the spec's literal §3.3 wording), that's a separate refactor — the Class C wiring would only need a small change in `handleQuickAddEmployee`.
5. **arabic locale.** `ar.json` is still mostly English placeholders project-wide; EP-5 did not add keys there (consistent with the project's pre-existing translation lag, per `CLAUDE.md` §L10n).

---

## Confidence

- **Related-data panels:** HIGH. The three migrations are minimal, additive, and follow the project's existing patterns (ResponsiveTableAdapter, EmptyState).
- **Class C round-trip:** MEDIUM-HIGH. The full flow is wired and unit-style logic is straightforward, but real e2e validation requires running the Playwright test against a live dev tenant — which EP-5 could not do from sandbox. The test file is in place and ready.
- **Subforms:** HIGH (on the decision to skip). The audit list does not match the codebase reality, and over-aggressive migration of flat forms would have introduced cruft.

---

## Files modified — full list

```
frontend/src/utils/returnContext.ts                          (created)
frontend/src/components/empty/SubformWithEmptyState.tsx      (created)
frontend/src/components/empty/RelatedDataPanel.tsx           (created)
frontend/src/pages/maintenance/EquipmentDetail.tsx           (edited — RelatedDataPanel x3)
frontend/src/pages/subscriptions/SubscriptionDetail.tsx      (edited — RelatedDataPanel x1, unhide dunning)
frontend/src/pages/iot/DeviceDetail.tsx                      (edited — RelatedDataPanel x1)
frontend/src/pages/helpdesk/TicketDetail.tsx                 (edited — Select+CTA+round-trip)
frontend/src/pages/HREmployees.tsx                           (edited — autoOpen + bounce-back)
frontend/src/locales/ku.json                                 (edited — 6 maintenance keys)
frontend/src/locales/en.json                                 (edited — 6 maintenance keys)
frontend/tests/e2e/class-c-return-token.spec.ts              (created)
```

No node_modules, no design-system/empty/*, no other agents' files were touched.
