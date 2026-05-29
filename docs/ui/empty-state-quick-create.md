# Empty State + Quick Create — Developer Guide

> Spec: `.kiro/specs/empty-state-quick-create/requirements.md` · `design.md` · `tasks.md`
> Audience: any FE engineer touching a form, list page, drawer, or selector.
> One sentence: **no user-facing surface in this app may render "No data" without a primary CTA.** Everything below explains how to honour that.

---

## 1. When to use which pattern — decision tree

```
                       ┌──────────────────────────────┐
   The surface is …    │  rendering zero rows /       │
                       │  zero options today          │
                       └──────────────┬───────────────┘
                                      │
       ┌──────────────────────────────┴──────────────────────────────┐
       │                                                             │
   user is in           is this a `<Select>`            is this a list page?
   ACTIVE search?       inside a form?                  (URL ends in /<entity>s)
       │                       │                                 │
       │ yes                yes│                                 │ yes
       ▼                       ▼                                 ▼
  variant="search"       variant="selector"                 variant="list"
  CTA = "Clear search"   use <SelectWithQuickCreate>        use <ListWithEmptyState>
  + optional             entity="<slug>"                    entity="<slug>"
  "Create '<query>'"
       │
       └─ surface is a drawer panel (activity log etc.)?  → variant="drawer", no CTA by default
       └─ surface is a subform inside a parent form?       → use <SubformWithEmptyState>
       └─ surface is system-generated (anomalies, audit)?  → variant="list", positive copy, no CTA
```

**Class A vs B vs C** (decides modal vs drawer vs navigate):

| Class | Required fields | UI | Examples |
|------:|-----------------|----|----------|
| **A** | ≤ 5 | Modal (`<QuickCreateModal>`) | customer, vendor, tax_rate, expense_category, tag |
| **B** | 5–15 | Drawer (`<QuickCreateDrawer>`) | item, account, bank_account, team, plan |
| **C** | needs multi-step or external workflow | Navigate with return token | employee, project (sometimes) |

If a Class A registry entry starts creeping past 5 required fields, **rewrite the form**, do not silently promote to B. The class is part of the registry entry's documentation block — any change needs an ADR.

---

## 2. Adding a new entity to the registry

The registry lives at `frontend/src/data/quickCreateRegistry.ts`. Every entity has one entry conforming to `QuickCreateConfig` (`design-system/empty/types.ts`).

### 2.1 Add the slug

In `design-system/empty/types.ts`, extend the `EntitySlug` union:

```ts
export type EntitySlug =
  | 'customer'
  | 'vendor'
  // …
  | 'my_new_entity';
```

### 2.2 Pick a class

Count the *required* fields on the server-side create endpoint (look at the Pydantic model in `backend/app/models/`). If the count is ≤ 5 you're in Class A; 5–15 in Class B; anything more, ask the tech lead.

### 2.3 Write the registry entry

```ts
QUICK_CREATE_REGISTRY.my_new_entity = {
  class: 'A',
  titleKey: 'qc.my_new_entity.title',
  emptyTitleKey: 'qc.my_new_entity.empty_title',
  descriptionKey: 'qc.my_new_entity.description',
  ctaKey: 'qc.my_new_entity.cta',
  illustration: 'inbox',
  fields: [
    { name: 'name', type: 'text', required: true, labelKey: 'qc.my_new_entity.field.name', autoFocus: true },
    { name: 'code', type: 'text', required: false, labelKey: 'qc.my_new_entity.field.code', maxLength: 16 },
  ],
  apiCreate: async (values, { signal }) => {
    const res = await api.post('/api/my-new-entities', values, { signal });
    return { id: res.data.id, label: res.data.name, raw: res.data };
  },
  loadOptions: async (search) => {
    const res = await api.get('/api/my-new-entities', { params: { q: search, limit: 30 } });
    return { options: res.data.items.map((x) => ({ value: x.id, label: x.name })) };
  },
  queryClass: 'B',
  permission: 'my_new_entity.create',
  fullFormHref: '/my-new-entities/new',
  queryInheritance: { field: 'name' },
};
```

### 2.4 Add i18n keys

Append `qc.my_new_entity.*` keys to **all three** locales (`ku`, `en`, `ar`). The `i18n:coverage` script will fail CI if any are missing.

### 2.5 Add a Vitest test

```ts
it('quick-create config for my_new_entity conforms', () => {
  const c = QUICK_CREATE_REGISTRY.my_new_entity;
  expect(c.class).toBe('A');
  expect(c.fields.length).toBeGreaterThan(0);
  expect(c.fields.filter((f) => f.required).length).toBeLessThanOrEqual(5);
});
```

### 2.6 Documentation block

Every registry entry MUST have a docblock above it:

```ts
/**
 * Class A. 3 required fields. Owner: Sales team.
 * First migrated PR: #1234 (InvoiceForm contact selector).
 * Reasoning for class: only `name`, `tax_id`, and `currency` are required on
 * the server; everything else has sensible defaults.
 */
QUICK_CREATE_REGISTRY.my_new_entity = { … };
```

---

## 3. Copy-writing rules

| Slot | Rule | Good | Bad |
|------|------|------|-----|
| Title | 1 line, ≤ 6 words, sentence case | "No customers yet" | "Customer List Is Currently Empty Of Records" |
| Description | 1 line, ≤ 14 words, explains what the entity is | "Customers are the people you invoice." | "There are no customers to display." |
| Primary CTA | Verb + noun, sentence case | "Add customer" | "New" / "Click here" |
| Secondary CTA | Same, lighter weight | "Import from CSV" | "More options…" |
| Search-empty CTA | Always "Clear search" first | "Clear search" | "Reset" |

**Avoid** the words *currently*, *records*, *items found*, *no results*. Avoid passive voice. Avoid "Please".

The Kurdish (Sorani) translations may run longer per word — leave 30% wrap headroom in the visual when designing.

---

## 4. Illustration usage — which of the 8?

| Key | Surface | Example entity |
|-----|---------|----------------|
| `customers` | people-shaped collections | customer, vendor, employee, team |
| `items` | physical goods | item, equipment, asset |
| `documents` | docs & forms | invoice, quote, bill, contract |
| `money` | money-flow | expense, payment, bank reconciliation |
| `inbox` | catch-all activity | notifications, audit log, anomalies |
| `chart` | reports & analytics | dashboards, custom reports |
| `box` | inventory-y collections | warehouse, stock location |
| `lock` | permission-gated empty | settings, RBAC, secure data |

Adding a new illustration: copy a Tabler or Phosphor SVG, simplify to 2 colors (`var(--c-primary)`, `var(--c-muted)`), inline into `EmptyStateIllustration.tsx`, add the key to `IllustrationKey`. ≤ 1.5 KB gzipped per SVG.

---

## 5. A11y checklist per surface

Run through this every time you migrate or add a surface:

- [ ] **Focus management** — modal/drawer focuses the first input on open; on close, focus returns to the originating selector or CTA.
- [ ] **aria-live** — the success toast is `polite`; the inline error region inside the modal is `assertive`.
- [ ] **Heading hierarchy** — the modal's title is `<h2>`, the description is regular paragraph; do not nest empty-state inside an `<h1>`.
- [ ] **Contrast** — illustration uses theme tokens; never inline hex. WCAG AA against both light and dark mode is enforced by the design-tokens lint rule.
- [ ] **Keyboard** — Tab cycles inputs → primary CTA → secondary → close. Esc closes (with dirty-confirm). Enter submits when focus is on the form.
- [ ] **Screen reader** — the empty-state container has `role="status"` and an `aria-label` derived from the title key.
- [ ] **RTL** — every illustration is symmetric or has an RTL variant. CSS uses logical properties (`inline-start`, not `left`).
- [ ] **Reduced motion** — confirm `useReducedMotion()` short-circuits the spring; the modal/drawer just crossfades.

---

## 6. Telemetry — what fires automatically

The `useEmptyStateTelemetry` hook fires these events without any per-call instrumentation:

| Event | Trigger | Default attributes |
|-------|---------|--------------------|
| `empty_state.shown` | first paint of any `<EmptyState>` | `variant`, `entity`, `surface`, `locale` |
| `empty_state.cta_clicked` | primary or secondary action click | `action`, `entity` |
| `empty_state.permission_gate_shown` | render of the Request-access fallback | `permission` |
| `quick_create.opened` | modal/drawer mount | `entity`, `prefill_present` |
| `quick_create.succeeded` | apiCreate resolved | `entity`, `duration_ms`, `field_count` |
| `quick_create.failed` | apiCreate rejected | `entity`, `error_code` |
| `quick_create.cancelled` | user dismissed without saving | `entity`, `was_dirty` |
| `quick_create.save_and_add_another` | drawer-only path | `entity`, `iteration` |

**Add custom attribution** by passing `context` to `<EmptyState>`, `<SelectWithQuickCreate>`, or any of the HOCs:

```tsx
<SelectWithQuickCreate
  entity="customer"
  context={{ feature: 'invoice-new', invoice_draft_id: draft.id }}
  value={contactId}
  onChange={setContactId}
/>
```

Every emitted event is merged with `context`. Keep keys short and snake_case — they end up as BigQuery column names.

---

## 7. Migrating an existing `<Select>` — codemod recipe

### Manual recipe

1. Identify the entity slug (look at the field name — `contact_id` → `customer`, `item_id` → `item`, etc.). If unsure, grep the form's submit handler for the API endpoint.
2. Confirm a registry entry exists for the slug. If not, add one (§2).
3. Replace:

   ```tsx
   // before
   <Form.Item name="contact_id" label="Customer">
     <Select options={customers} loading={loading} />
   </Form.Item>
   ```

   ```tsx
   // after
   <Form.Item name="contact_id" label="Customer">
     <SelectWithQuickCreate
       entity="customer"
       value={form.getFieldValue('contact_id')}
       onChange={(v) => form.setFieldValue('contact_id', v)}
     />
   </Form.Item>
   ```

4. Remove the now-unused `useQuery` / `useState` that fetched the options — `SelectWithQuickCreate` owns this lifecycle.
5. Add the Playwright snapshot test (template in §9).
6. Run `npm run lint -- --rule 'local/quick-create-select: error'` — should print zero errors for this file.
7. Run `node scripts/audit-empty-states.mjs` — the pending count should drop by 1.

### Codemod (optional — for bulk migrations)

A simple jscodeshift codemod lives in `scripts/codemods/select-to-quickcreate.js` (TODO — file for now; flagged in `_deltas/EP-6-summary.md`). It handles the trivial cases; you still review each diff before commit.

### Manual checklist for the reviewer

- [ ] Old options-fetching hook removed (no orphan `useQuery` lurking).
- [ ] Field name is preserved (the form's submit shape doesn't change).
- [ ] i18n keys exist in all locales.
- [ ] Playwright snapshot added.
- [ ] Bundle-size delta < 5 KB (bundle-diff bot will comment).
- [ ] Audit ratchet ticked DOWN (CI green).

---

## 8. i18n keys — naming and parity

Convention: `qc.<entity>.<key>` for quick-create copy; `empty.<surface>.<key>` for top-level empty state copy.

### Required per entity

| Key | Used for |
|-----|----------|
| `qc.<entity>.title` | modal/drawer title |
| `qc.<entity>.empty_title` | empty state's title above the CTA |
| `qc.<entity>.description` | empty state's description |
| `qc.<entity>.cta` | primary CTA label |
| `qc.<entity>.field.<name>` | one per field in `fields[]` |
| `qc.<entity>.full_form_link` | "Need more fields? Full form…" |

### Required global

| Key | Used for |
|-----|----------|
| `empty.search_no_results.title` | search-empty header |
| `empty.search_no_results.description` | search-empty body |
| `empty.search_clear` | "Clear search" |
| `qc.action.create_and_select` | "Create & Select" primary on Class A |
| `qc.action.full_form` | "Full form…" |
| `qc.action.save_and_add_another` | drawer secondary |
| `qc.action.cancel_confirm` | "You have unsaved changes. Discard?" |

### Parity check

```
npm run i18n:coverage
```

Fails CI on:
- Any key present in `en.json` but missing in `ku.json` or `ar.json`.
- Any value that is `""`, `null`, `"TODO"`, or `"[missing]"`.

---

## 9. Testing your migration

### Playwright snapshot template

```ts
// frontend/e2e/empty-state.<entity>.spec.ts
import { test, expect } from '@playwright/test';

test.describe('quick-create: <entity>', () => {
  test('selector empty → CTA → modal → success → auto-select', async ({ page }) => {
    await page.goto('/<surface-where-the-selector-lives>');
    await page.getByTestId('<entity>-selector').click();

    // Empty state visible.
    await expect(page.getByRole('status', { name: /qc\.<entity>\.empty_title/i })).toBeVisible();

    // Click CTA.
    await page.getByRole('button', { name: /qc\.<entity>\.cta/i }).click();

    // Modal open + first field focused.
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('input').first()).toBeFocused();

    // Fill + submit.
    await page.fill('input[name="name"]', 'Test entity X');
    await page.getByRole('button', { name: /qc\.action\.create_and_select/i }).click();

    // Closed + selected.
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.getByTestId('<entity>-selector')).toContainText('Test entity X');
  });
});
```

### Vitest unit test

```ts
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectWithQuickCreate } from '@/design-system/empty/SelectWithQuickCreate';

it('opens the modal on empty-state CTA click', async () => {
  render(<SelectWithQuickCreate entity="customer" />);
  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.click(screen.getByRole('button', { name: /add customer/i }));
  await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
});
```

---

## 10. Anti-patterns to avoid

1. **Long lists in modals.** If a Class A entity ends up needing > 5 inputs, redesign — do not push it into the modal and shrink the typography.
2. **Dropdown-in-dropdown.** Never nest a `<Select>` inside the Quick Create modal that itself does quick-create. If the user needs to create a related entity first, link out via "Full form…" instead. (The exception: tax_rate inside customer is fine because tax_rate's quick-create is small and well-tested.)
3. **Secret CTAs under "More".** The primary CTA must be visible in the empty state — never hidden behind a kebab menu.
4. **"No data" anywhere user-facing.** The ESLint rule `local/empty-state-required` enforces this. If you genuinely need raw Antd `<Empty />` (e.g. an internal debug screen), put `// empty-state-exempt: <reason>` on the line above. Reasons get reviewed at audit time.
5. **Misleading illustration.** Don't use `money` for a non-financial entity just because it looks pretty. The illustration set is small on purpose.
6. **Skipping i18n keys for "we'll get to it".** The `i18n:coverage` script will block your PR. Always add keys in all three locales, even if the Arabic value temporarily equals the English (mark it `// TODO(ar): translate` and file a translation ticket).
7. **Inline `style={{ color: '#...' }}` in the empty state.** Use tokens. The design-tokens lint rule will flag it.
8. **Telemetry suppression.** Never wrap `<EmptyState>` in a way that intercepts the telemetry hook (e.g., conditional rendering inside `useMemo`). The hook fires once on mount — keep that invariant.

---

## 11. Where to look when something breaks

| Symptom | First check |
|---------|-------------|
| Modal opens but doesn't pre-fill the search | `queryInheritance.field` on the registry entry; default is `name`. |
| Submit succeeds but the selector doesn't auto-select | `apiCreate` must return `{ id, label, raw }`. A missing `id` silently breaks merge. |
| "Permission denied" empty state | `permission` string on the registry entry — match against the user's role grants. |
| Bundle delta > 15 KB | The quick-create chunk pulled in too many transitive deps. Inspect the bundle-diff bot artifact; usually a `dayjs` or `lodash` import. |
| Snapshot diff in unrelated locale | Translation drift — the i18n file got edited but the snapshot baseline didn't refresh. Rerun `npm run e2e:update-snapshots` and review. |

---

## 12. Cross-references

- `frontend/src/design-system/empty/` — all components.
- `frontend/src/data/quickCreateRegistry.ts` — the registry.
- `scripts/audit-empty-states.mjs` — audit + ratchet.
- `tools/eslint-rules/empty-state-required.js` — `<Empty />` ban.
- `tools/eslint-rules/quick-create-select.js` — `<Select>` ratchet.
- `docs/ui/empty-state-v2-retirement.md` — flag-retirement plan.
- `docs/observability/empty-state-funnel-dashboard.md` — telemetry dashboard.

When in doubt, re-read Requirement 1 of the spec: *every empty state has a CTA.* If you can't surface one, the surface is mis-designed — escalate to product, don't fall back to "No data".
