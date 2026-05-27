# EP-3 — Class B Drawer Entities — Delivery Summary

> Spec: `.kiro/specs/empty-state-quick-create/`
> Phase: EP-3 (Week 4-5)
> Scope: polish drawer with vertical Steps, add file/image upload field types, migrate Class B drawer selectors, wire "Save & Add another" telemetry.
> Owner: EP-3 Drawer Specialist
> Date: 2026-05-28

---

## 1. Files created

### Drawer polish (T-E.3.1)

- **`frontend/src/design-system/empty/QuickCreateDrawerWithSteps.tsx`**
  - HOC over EP-0's `QuickCreateDrawer`. Reads `config.sections[]` from the registry; renders Antd `Steps direction="vertical"` on the left at 200px width; right panel renders only the active section's fields.
  - Falls back to the basic drawer when: registry entry has no `sections`, OR field count <= 8, OR `class !== 'B'`.
  - Per-section validation: `Next` advances only when active section's fields validate. The Steps indicator supports clicking back to any earlier step freely; forward-jumps validate first.
  - Save flow: validates every section in sequence; on first failure, jumps to that step and marks it `status: 'error'`. On success, hands the new record to the originating selector via `onSuccess`.
  - "Save & Add another" path: fires `quick_create.save_and_add_another` telemetry, resets form fields, returns to step 0, refocuses the first input — drawer stays open. (Task T-E.3.5.)

### File / image upload field types (T-E.3.4)

- **`frontend/src/design-system/empty/FileUploadField.tsx`**
- **`frontend/src/design-system/empty/ImageUploadField.tsx`**
  - Antd `<Upload>` wrappers with two storage strategies probed at runtime:
    1. **Firebase Storage** — `import('../../firebase')` + `import('firebase/storage')`. If both resolve, uploads to `quickcreate/{entity}/{tempId}/{filename}` and stores the resulting `downloadURL` in form state.
    2. **Base64 fallback** — if Firebase isn't initialized, the file is read as a `data:` URL and stored in form state with `storage: 'base64-pending'`. The future `/api/uploads` endpoint should consume this.
  - `ImageUploadField` adds: MIME-type guard (`image/*` only), thumbnail preview via `<Upload listType="picture-card">`, and a remove button.
  - Both fields are `Form.Item`-compatible (`value` / `onChange`).
  - Both respect `disabled` and enforce a configurable max size (default 10 MB for files, 5 MB for images).

---

## 2. Files modified (migrations)

| File | Selector | Entity | Nature of change |
|------|----------|--------|------------------|
| `frontend/src/pages/helpdesk/TicketsList.tsx` | `team_id` Select inside FormDialog | `team` | Added `SelectWithQuickCreate` import; replaced the legacy `<Select>{teams.map...}</Select>` with `<SelectWithQuickCreate entity="team" options={...} />`. |
| `frontend/src/pages/CycleCounts.tsx` | `location_id` Select | `location` | Added `SelectWithQuickCreate` import; replaced legacy `<Select>` with quick-create variant; preserved `disabled={!selectedWarehouse}` constraint. |
| `frontend/src/pages/PutawayRules.tsx` | `target_location_id` Select | `location` | Added `SelectWithQuickCreate` import; replaced legacy `<Select>` with quick-create variant. |
| `frontend/src/pages/BankReconciliation.tsx` | `bank_account` Select | `bank_account` | **Already migrated by EP-2** (T-E.2.6). No action required. |
| `frontend/src/pages/subscriptions/SubscriptionsList.tsx` | `plan_id` Select | `subscription_plan` | **Already migrated by EP-2** (T-E.2.2). No action required. |

Three Class B migrations completed this phase. Two were already done upstream.

---

## 3. Registry / contract extensions

> **For EP-0 to incorporate.** These are additive — they do not break existing entries.

### 3.1 `FieldDef.type` union — additions

The drawer needs to render uploaders for entities like `item` (which has an image). EP-3 adds two values to the `FieldDef.type` discriminated union:

```ts
// Before (EP-0):
type FieldDef = {
  name: string;
  type: 'text' | 'tel' | 'email' | 'number' | 'select' | 'textarea';
  // ...
};

// After (EP-3 extension):
type FieldDef = {
  name: string;
  type:
    | 'text' | 'tel' | 'email' | 'number' | 'select' | 'textarea'
    | 'file'    // EP-3 — renders <FileUploadField>
    | 'image';  // EP-3 — renders <ImageUploadField>
  // optional only for file/image:
  accept?: string;
  maxSizeMB?: number;
  // ...
};
```

`DynamicForm` (EP-0) needs a `case 'file': return <FileUploadField .../>` arm and likewise for `image`.

### 3.2 Optional `sections` shape

`QuickCreateDrawerWithSteps` reads an OPTIONAL `sections` field off the registry config:

```ts
type QuickCreateConfig = {
  // ...existing fields...
  /**
   * EP-3 — optional. When present AND `class === 'B'` AND `fields.length > 8`,
   * the drawer renders a vertical Steps indicator and shows only the active
   * section's fields. Sections may reference fields by name (string) or
   * by full FieldDef object.
   */
  sections?: {
    key: string;            // stable id, used as React key
    titleKey: string;       // i18n key for the step label
    fields: (string | FieldDef)[];
  }[];
};
```

Recommended seed for `item` (matches design.md §2.1):

```ts
sections: [
  { key: 'basic',      titleKey: 'qc.item.section.basic',      fields: ['name', 'sku', 'item_type', 'unit'] },
  { key: 'pricing',    titleKey: 'qc.item.section.pricing',    fields: ['selling_price', 'cost_price', 'tax_id'] },
  { key: 'accounting', titleKey: 'qc.item.section.accounting', fields: ['income_account_id', 'expense_account_id'] },
  { key: 'inventory',  titleKey: 'qc.item.section.inventory',  fields: ['description', 'image'] },
],
```

### 3.3 Telemetry event — new

- `quick_create.save_and_add_another` — fires when the drawer's secondary CTA is clicked and the save succeeds. Payload: `{ entity }`. Useful for measuring batch-create behavior (T-E.3.5). Falls back gracefully if `useEmptyStateTelemetry` doesn't yet export `.fire(...)` — see open question OQ-3.

---

## 4. Open questions / gaps

| ID | Question | Impact | Default |
|----|----------|--------|---------|
| OQ-1 | EP-0's `QuickCreateDrawer.tsx`, `DynamicForm.tsx`, `SelectWithQuickCreate.tsx`, `useEmptyStateTelemetry.ts`, and `quickCreateRegistry.ts` are not yet in the repo. EP-3 files import them as **contracts**. If EP-0's shapes drift, EP-3 will need a quick adapter PR. | Medium — blocks integration tests until EP-0 ships. | Document the shapes in this delta and reconcile at integration. |
| OQ-2 | No `frontend/src/firebase/` module exists today. The upload fields probe for it dynamically (`import('../../firebase')` wrapped in try/catch). | Low — base64 fallback is the working path until Firebase Storage is initialized. | Until Firebase Storage is wired, every quick-create upload becomes a base64 payload sent in the apiCreate body. Backend needs `/api/uploads` (still missing — TODO). |
| OQ-3 | The design's telemetry helper exports specific named fires (`fireShown`, `fireOpened`, etc.). The "Save & Add another" event is new in EP-3 — we add it as `.fire('quick_create.save_and_add_another', ...)` with a generic-fire fallback. EP-0 should add a named method `fireSaveAndAddAnother` for type safety. | Low. | Generic fire works today; rename in a follow-up. |
| OQ-4 | `team` entity does not yet have `sections` in the registry. The 1-2 fields it ships with (name, members) are < 8, so it correctly drops to basic drawer. When members + permissions + description push field count above 8, add a section block. | Low. | No action this phase. |
| OQ-5 | The `team` selector in `TicketsList.tsx` previously loaded teams via `api.get('/api/helpdesk/teams')` and passed them as inline `<Select.Option>` rows. We forward those as `options=` for back-compat, but the spec's `SelectWithQuickCreate` is supposed to load its own options from `config.loadOptions`. EP-0's component must accept an `options` override OR define `config.team.loadOptions` to call `/api/helpdesk/teams`. | Medium — without this, the dropdown will be empty until EP-0 lands. | Pass-through `options` prop expected. |

---

## 5. Constraints honored

- **Did not modify** `EmptyState.tsx`, `SelectWithQuickCreate.tsx`, `QuickCreateModal.tsx`, or `QuickCreateDrawer.tsx` (the basic one). EP-0 owns them.
- **Only added** new files in `frontend/src/design-system/empty/`.
- **Registry shape extension** is additive — documented above for EP-0 to merge.

---

## 6. Confidence

**Medium-high (75%).**

What works confidently:
- The vertical-Steps drawer is a self-contained HOC; its fallback to the basic drawer means it can ship even before EP-0 fully wires sections to all registry entries.
- The upload fields are storage-agnostic; the base64 fallback guarantees they always produce a usable payload.
- The 3 selector migrations are mechanical replacements that preserve existing visual + data behavior.

What's uncertain:
- EP-0 contracts (component paths, prop shapes, registry field types) are inferred from `design.md`. If EP-0 chose different names (e.g., `config.steps` instead of `config.sections`, or `SelectWithQuickCreate` doesn't accept an `options` prop), the migration sites and the steps drawer need small renames.
- Without a working build, the new files were not type-checked. Recommended: run `npx tsc --noEmit` after EP-0 lands to catch contract drift.
- Firebase Storage path is currently dead code (no Firebase init); base64 path is the de-facto behavior.

---

## 7. Verification checklist (post EP-0 integration)

- [ ] `frontend/src/design-system/empty/QuickCreateDrawer.tsx` exists and exports `QuickCreateDrawer`.
- [ ] `frontend/src/design-system/empty/DynamicForm.tsx` exists and supports `type: 'file' | 'image'` cases (EP-0 must add).
- [ ] `frontend/src/data/quickCreateRegistry.ts` exports `EntitySlug`, `QuickCreateConfig`, `FieldDef`, and `QUICK_CREATE_REGISTRY`.
- [ ] Registry has an entry for each of: `team`, `location`, `bank_account`, `subscription_plan`, `item` (Class B).
- [ ] `item` entry has `sections: [...]` per §3.2 above.
- [ ] `useEmptyStateTelemetry` exports a fallback `.fire(event, attrs)` method or a named `fireSaveAndAddAnother`.
- [ ] Playwright: open `/helpdesk/tickets`, create ticket → team dropdown empty → click CTA → drawer opens → multi-step Steps appear → fill all steps → "Save & Add another" → form resets, drawer remains open.
- [ ] Bundle-diff: drawer-with-steps chunk ≤ 12 KB gzipped (per Requirements §13.1).
