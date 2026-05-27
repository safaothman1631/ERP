# Design Document: Empty State + Quick Create — Architecture

> **Spec ID:** `empty-state-quick-create`
> **Companion to:** `requirements.md`
> **Status:** Draft v1.0
> **Owner:** Safa Othman

## Introduction

This document specifies the architecture that satisfies the requirements: a small set of reusable primitives, a single per-entity registry, three execution modes (modal, drawer, navigate), motion tokens, and a migration path.

The shape of the system after this spec lands:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Component primitives (always-loaded, < 8KB gz total)                 │
│   ├─ <EmptyState>          — fires telemetry, renders illustration   │
│   ├─ <EmptyStateIllustration> — 8 inline SVGs                        │
│   ├─ <ErrorState>           — error variant                          │
│   ├─ <LoadingState>         — skeleton variant                       │
│   └─ <StateSwitch>           — composes loading|empty|error|populated │
└──────────────────┬───────────────────────────────────────────────────┘
                   │ consumes
┌──────────────────▼───────────────────────────────────────────────────┐
│ Higher-order patterns                                                │
│   ├─ <SelectWithQuickCreate>  — wraps Antd Select; registry-driven   │
│   ├─ <ListWithEmptyState>     — wraps ResponsiveTable; auto-empty    │
│   ├─ <SubformWithEmptyState>  — for in-form repeating sections       │
│   └─ <RelatedDataPanel>        — for drawers + side panels           │
└──────────────────┬───────────────────────────────────────────────────┘
                   │ reads from
┌──────────────────▼───────────────────────────────────────────────────┐
│ Per-entity registry  (frontend/src/data/quickCreateRegistry.ts)      │
│   { customer: {...}, vendor: {...}, item: {...}, ...14 entries }     │
└──────────────────┬───────────────────────────────────────────────────┘
                   │ each entry references
┌──────────────────▼───────────────────────────────────────────────────┐
│ Quick-create UIs  (lazy-loaded per entity)                           │
│   ├─ <QuickCreateModal>      — Class A entities                      │
│   ├─ <QuickCreateDrawer>     — Class B entities                      │
│   └─ navigateWithReturnToken — Class C entities                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 1. Component primitives

### 1.1 `<EmptyState>` — the workhorse

Path: `frontend/src/design-system/empty/EmptyState.tsx`. Always in the app shell.

```tsx
import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Button } from 'antd'
import { Illustration } from './EmptyStateIllustration'
import { useEmptyStateTelemetry } from './useEmptyStateTelemetry'
import type { EmptyStateProps } from './types'

const transition = { type: 'spring', stiffness: 240, damping: 22, duration: 0.22 }
const motionVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
}

export function EmptyState({
  variant,
  illustration,
  titleKey,
  descriptionKey,
  primaryAction,
  secondaryAction,
  permissionGate,
  context,
}: EmptyStateProps) {
  const { t } = useTranslation('common')
  const reduceMotion = useReducedMotion()
  const telemetry = useEmptyStateTelemetry({ variant, context })

  // Permission-aware CTA replacement
  const cta = useResolveCta(primaryAction, permissionGate)

  // Fire telemetry once on mount
  useEffect(() => telemetry.fireShown(), [])

  return (
    <motion.div
      variants={motionVariants}
      initial={reduceMotion ? false : 'hidden'}
      animate="visible"
      transition={reduceMotion ? { duration: 0.12 } : transition}
      role="status"
      aria-live="polite"
      className={`empty-state empty-state--${variant}`}
    >
      <Illustration name={illustration} aria-hidden="true" />
      <h3 className="empty-state__title">{t(titleKey)}</h3>
      <p className="empty-state__description">{t(descriptionKey)}</p>
      <div className="empty-state__actions">
        {cta && (
          <Button
            type="primary"
            icon={cta.icon}
            onClick={() => {
              telemetry.fireCtaClicked()
              cta.onClick()
            }}
            data-testid={`empty-state-cta-${variant}`}
          >
            {t(cta.labelKey)}
          </Button>
        )}
        {secondaryAction && (
          <Button type="link" onClick={secondaryAction.onClick}>
            {t(secondaryAction.labelKey)}
          </Button>
        )}
      </div>
    </motion.div>
  )
}
```

CSS tokens (in `EmptyState.css`):
- Container: 24px padding, centered, max-width 320px, gap 16px between children.
- Title: 18px/1.4, font-weight 600, color `--text-primary`.
- Description: 14px/1.5, font-weight 400, color `--text-secondary`.
- Spacing: 24px between illustration and title; 8px title-description; 24px before button.

### 1.2 `<EmptyStateIllustration>` — 8 inline SVGs

Path: `frontend/src/design-system/empty/EmptyStateIllustration.tsx`.

A switch over 8 keys, each rendering an inline SVG ≤ 500 bytes. Sourced from a permissive icon set (Tabler / Phosphor — pick one), simplified to two colors via design-token CSS variables:

```tsx
const ILLUSTRATIONS = {
  customers: <CustomersSvg />,
  items: <ItemsSvg />,
  documents: <DocumentsSvg />,
  money: <MoneySvg />,
  inbox: <InboxSvg />,
  chart: <ChartSvg />,
  box: <BoxSvg />,
  lock: <LockSvg />,
} as const

export function Illustration({ name }: { name: keyof typeof ILLUSTRATIONS }) {
  return <div className="empty-state__illustration">{ILLUSTRATIONS[name]}</div>
}
```

Total budget: 8 illustrations × ~500 bytes = 4 KB inline. The whole `empty/` directory: ≤ 8 KB gzipped (Requirement 13.1).

### 1.3 `<LoadingState>` and `<ErrorState>`

Loading: Antd `Skeleton` wrapped with the same outer container so transitions cross-fade cleanly.

Error: similar shape to `EmptyState` but with an alert icon, an error description (single line), and a single "Retry" button.

### 1.4 `<StateSwitch>` — the composition primitive

```tsx
<StateSwitch
  loading={isFetching}
  error={error}
  empty={data?.length === 0}
  populated={<Table rows={data} />}
  loadingState={<LoadingState rows={5} />}
  errorState={<ErrorState onRetry={refetch} />}
  emptyState={<EmptyState ...config... />}
/>
```

This component is the **mandatory entry point** — code review rejects any direct rendering of `<EmptyState>` outside `<StateSwitch>` (lint rule).

---

## 2. Per-entity quick-create registry

Path: `frontend/src/data/quickCreateRegistry.ts`.

### 2.1 Registry shape

```ts
import type { QuickCreateConfig } from './types'

export const QUICK_CREATE_REGISTRY: Record<EntitySlug, QuickCreateConfig> = {
  customer: {
    class: 'A',
    titleKey: 'qc.customer.title',
    descriptionKey: 'qc.customer.description',
    illustration: 'customers',
    fields: [
      { name: 'display_name', type: 'text', required: true, labelKey: 'fields.name', autoFocus: true },
      { name: 'phone', type: 'tel', required: false, labelKey: 'fields.phone' },
      { name: 'email', type: 'email', required: false, labelKey: 'fields.email' },
      { name: 'contact_type', type: 'select', options: [
          { value: 'customer', labelKey: 'enums.contact_type.customer' },
          { value: 'vendor', labelKey: 'enums.contact_type.vendor' },
        ], default: 'customer' },
    ],
    apiCreate: async (values, ctx) => {
      const { data } = await axios.post('/api/contacts', values, { signal: ctx.signal })
      return { id: data.id, label: data.display_name, raw: data }
    },
    queryClass: 'C' as const,  // Cold reference per design.md §1.3
    permission: 'contacts.create',
    fullFormHref: '/contacts/new',
    queryInheritance: { field: 'display_name', detectors: ['email', 'phone'] },
  },
  vendor: { class: 'A', /* identical shape, contact_type default = vendor */ },
  tax_rate: {
    class: 'A',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'rate', type: 'number', required: true, min: 0, max: 100, suffix: '%' },
      { name: 'tax_type', type: 'select', options: [/* VAT, GST, withholding */], default: 'VAT' },
    ],
    apiCreate: (v) => post('/api/taxes', v),
    permission: 'taxes.create',
    fullFormHref: '/settings/taxes/new',
  },
  expense_category: { class: 'A', fields: [name, description] },
  payment_method: { class: 'A', fields: [name, type, account_id] },
  currency: { class: 'A', fields: [code, symbol, name, decimals] },
  tag: { class: 'A', fields: [name, color] },
  item: {
    class: 'B',
    fields: [name, sku, item_type, unit, selling_price, cost_price, tax_id, income_account_id, expense_account_id, description, image],
    apiCreate: (v) => post('/api/items', v),
    permission: 'items.create',
    fullFormHref: '/items/new',
  },
  account: { class: 'B', fields: [code, name, type, parent_account_id, currency, description] },
  bank_account: { class: 'B', fields: [...] },
  team: { class: 'B', fields: [name, description, members] },
  subscription_plan: { class: 'B', fields: [name, billing_period, price, currency, trial_days] },
  location: { class: 'B', fields: [name, address, code, region, country] },
  employee: { class: 'C', fields: 'see HR onboarding', fullFormHref: '/hr/employees/new?returnTo=' },
}
```

### 2.2 Class decision rules

| Class | Trigger | UI |
|-------|---------|-----|
| **A** | ≤ 5 required fields, no nested entity dependency, ≤ 5 KB chunk | Modal |
| **B** | 5–15 fields, may have file upload, may have steps | Drawer (480px) |
| **C** | > 15 fields, multi-step, requires onboarding, or has side-effects (creates user accounts) | Navigate with `?returnTo=<token>` |

### 2.3 Adding a new entity

Required template (enforced by a lint rule + a registry-doc test):

```ts
// === ENTITY: <name> ====================================================
// Class: A / B / C
// Reasoning: <1-2 sentences why this class>
// Permission: <resource>.<verb>
// Owner: @<team>
// First migrated in: <PR link>
// =====================================================================
```

---

## 3. Quick-create execution

### 3.1 Class A — `<QuickCreateModal>`

Path: `frontend/src/design-system/empty/QuickCreateModal.tsx`. Lazy-loaded; entry chunk ≤ 12 KB gzipped.

Skeleton:

```tsx
export function QuickCreateModal({ entity, open, onClose, onSuccess, prefill }: Props) {
  const config = QUICK_CREATE_REGISTRY[entity]
  const [values, setValues] = useState(() => mergePrefill(config.fields, prefill))
  const { mutate, isLoading } = useMutation({
    mutationFn: (v) => config.apiCreate(v, { signal }),
    onSuccess: (result) => {
      telemetry.fireSucceeded({ entity, time_to_save_ms: stopwatch.elapsed() })
      onSuccess(result)        // hands the new record to the originating selector
      onClose()
    },
    onError: (err) => {
      telemetry.fireFailed({ entity, error_code: err.code })
      setInlineErrors(err.fieldErrors)
    },
  })

  return (
    <Modal open={open} onCancel={onCloseConfirm} title={t(config.titleKey)} footer={null} width={420}>
      <DynamicForm
        fields={config.fields}
        values={values}
        errors={inlineErrors}
        onChange={setValues}
        onSubmit={mutate}
      />
      <ModalActions
        primary={{ labelKey: 'qc.action.create_and_select', onClick: () => mutate(values), loading: isLoading }}
        secondary={{ labelKey: 'common.cancel', onClick: onCloseConfirm }}
        link={{ labelKey: 'qc.action.full_form', href: config.fullFormHref + (prefill?.search ? `?name=${prefill.search}` : '') }}
      />
    </Modal>
  )
}
```

The modal uses an existing `<DynamicForm>` schema engine (we extend the one in `design-system/InlineEdit` for this purpose — single source of truth for form rendering).

### 3.2 Class B — `<QuickCreateDrawer>`

Same shape but rendered via Antd `Drawer placement="end" width={480}`. Includes Steps indicator on the left for long forms, file upload support, and a "Save & Add another" secondary action.

### 3.3 Class C — `navigateWithReturnToken`

For complex entities. The selector calls:

```ts
const token = saveReturnContext({
  surface: 'invoice-form/contact-selector',
  state: serializeFormState(),
})
navigate(`${config.fullFormHref}?returnTo=${token}`)
```

The destination create page reads `?returnTo=` and, on save, navigates back and rehydrates the state, then selects the new record. State is stored in `sessionStorage` keyed by the token; auto-expires after 1 hour.

---

## 4. Higher-order patterns

### 4.1 `<SelectWithQuickCreate>` — the universal Select replacement

This is the API the migration will reach for in 42 places:

```tsx
<SelectWithQuickCreate
  entity="customer"
  value={contactId}
  onChange={setContactId}
  loadOptions={fetchContacts}    // optional; default uses QUICK_CREATE_REGISTRY[entity].listResource
  prefillFromSearch              // default true: typed query becomes name prefill
  className="..."
  placeholder={t('select.customer')}
  // anything else passed to inner Antd Select
/>
```

Internally:

```tsx
function SelectWithQuickCreate({ entity, ...rest }: Props) {
  const config = QUICK_CREATE_REGISTRY[entity]
  const [search, setSearch] = useState('')
  const [qcOpen, setQcOpen] = useState(false)
  const { data, isLoading, error, refetch } = useClassedQuery(
    [entity, 'options', search],
    () => config.loadOptions(search),
    config.queryClass,
  )

  return (
    <>
      <Select
        showSearch
        loading={isLoading}
        options={data?.options ?? []}
        onSearch={setSearch}
        notFoundContent={
          <StateSwitch
            loading={isLoading}
            error={error}
            empty={(data?.options ?? []).length === 0}
            populated={null}
            emptyState={
              search
                ? <EmptyState variant="search" titleKey="empty.search_no_results" .../>
                : <EmptyState variant="selector" {...emptyConfigFor(config)} primaryAction={{
                    labelKey: `qc.${entity}.cta`,
                    onClick: () => setQcOpen(true),
                    icon: <PlusOutlined />,
                  }} />
            }
          />
        }
        dropdownRender={(menu) => <DropdownWithEmpty menu={menu} count={data?.options?.length} />}
        {...rest}
      />
      <QuickCreateModal
        entity={entity}
        open={qcOpen}
        onClose={() => setQcOpen(false)}
        prefill={{ search }}
        onSuccess={(record) => {
          // optimistic merge into cache, top of list
          queryClient.setQueryData([entity, 'options', search], (old: any) => ({
            options: [{ value: record.id, label: record.label }, ...(old?.options ?? [])],
          }))
          rest.onChange?.(record.id)
        }}
      />
    </>
  )
}
```

The component is the **single migration target** for all 42 selectors.

### 4.2 `<ListWithEmptyState>`

Wraps `ResponsiveTable`. When data is empty, renders the empty state inside the table canvas (not below it). For list pages the variant is `list` with a more prominent illustration (96px instead of 64px).

### 4.3 `<SubformWithEmptyState>`

Wraps repeating-row sections inside forms (line items, schedules). Empty state is inline at the section's row position, with an "+ Add first item" CTA.

### 4.4 `<RelatedDataPanel>`

For drawers/side panels showing related records. The empty state has no CTA by default (related data is contextual) but supports an optional secondary CTA.

---

## 5. Motion tokens (Framer Motion)

```ts
// frontend/src/design-system/empty/motion.ts
export const SPRING_GENTLE = { type: 'spring', stiffness: 240, damping: 22 } as const
export const SPRING_TACTILE = { type: 'spring', stiffness: 320, damping: 26 } as const
export const DURATION_FAST = 0.12
export const DURATION_NORMAL = 0.22
export const DURATION_SLOW = 0.32

export const STAGGER_DELAY = 0.03      // 30ms per item
export const STAGGER_MAX_INDEX = 16    // beyond this, no stagger

export const variants = {
  emptyStateEnter: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: SPRING_GENTLE },
  },
  modalEnter: {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: SPRING_GENTLE },
  },
  drawerEnter: {
    hidden: { x: '100%' },
    visible: { x: 0, transition: SPRING_GENTLE },
  },
  rowStagger: (i: number) => ({
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { delay: Math.min(i, STAGGER_MAX_INDEX) * STAGGER_DELAY } },
  }),
  highlightPulse: {
    animate: { backgroundColor: ['rgba(24,144,255,0)', 'rgba(24,144,255,0.18)', 'rgba(24,144,255,0)'] },
    transition: { duration: 0.6 },
  },
}
```

All motion **must** check `useReducedMotion()` and fall back to a 120ms crossfade.

---

## 6. Telemetry plumbing

### 6.1 Event emission

A small helper `useEmptyStateTelemetry` that wraps the existing `web-vitals`-style RUM batcher (see `frontend/src/observability/vitals.ts`):

```ts
function useEmptyStateTelemetry({ variant, context }: Params) {
  const route = useLocation().pathname
  const session = useSessionId()

  const fire = (event: string, attrs: Record<string, unknown>) => {
    rumIngest.enqueue({
      event,
      sessionId: session,
      route,
      variant,
      ...context,
      ...attrs,
      timestamp: Date.now(),
    })
  }

  return {
    fireShown:        () => fire('empty_state.shown', { has_search_query: !!context?.search }),
    fireCtaClicked:   () => fire('empty_state.cta_clicked', {}),
    fireOpened:       (entity) => fire('quick_create.opened', { entity, prefilled_field: context?.prefill?.field }),
    fireCancelled:    (entity, openMs, wasDirty) => fire('quick_create.cancelled', { entity, time_open_ms: openMs, was_dirty: wasDirty }),
    fireSucceeded:    (entity, saveMs) => fire('quick_create.succeeded', { entity, time_to_save_ms: saveMs }),
    fireFailed:       (entity, errorCode) => fire('quick_create.failed', { entity, error_code: errorCode }),
    fireFullFormLink: (entity, openMs) => fire('quick_create.full_form_link_clicked', { entity, time_open_ms: openMs }),
  }
}
```

### 6.2 Dashboard

A new Cloud Monitoring dashboard `empty-state-funnel` with the conversion funnel per entity, refreshed via the existing BigQuery `vitals_raw` aggregation.

---

## 7. Feature flag and rollout

### 7.1 Flag: `ui.empty_state_v2`

- Default OFF in production until Phase 2 ships first 10 surfaces.
- Per-tenant override via the existing feature-flag system (`frontend/src/api/featureFlags.ts`).
- A second flag `ui.empty_state_v2.<entity>` allows turning on / off per entity for staged rollout.

### 7.2 Rollout schedule

| Wave | When | What |
|------|------|------|
| Internal | Phase 1 end | Dev tenants only |
| 5% canary | Phase 2 end | 5% of prod tenants, top-10 surfaces |
| 100% top-10 | Phase 3 end | All prod tenants, top-10 surfaces |
| Long tail | Phase 4 end | All 76 surfaces, flag retired |

### 7.3 Rollback

Single switch off → reverts everything in < 30 seconds (next page load).

---

## 8. Migration approach

### 8.1 The codemod

A jscodeshift script `scripts/codemod-select-to-qc.js` that:

1. Finds `<Select ... />` usages inside form fields.
2. Identifies the entity via static analysis (variable names, props, fetched URL).
3. Rewrites to `<SelectWithQuickCreate entity="customer" ... />`.
4. Removes any now-unused `notFoundContent` or `Empty` imports.

Limitations: requires a per-PR human review. The codemod handles ~70% of cases automatically; the rest are flagged for manual migration.

### 8.2 Per-PR safety

Each migration PR:

1. One surface per PR (focused review).
2. A Playwright snapshot test added: empty, populated, search-with-no-results, opens modal, modal-submit, modal-cancel.
3. Telemetry event names verified in `audit/empty-state-telemetry-events.json`.
4. Bundle-size diff in PR comment (the bot from P0).

### 8.3 Ratchet rules

- Once a surface is migrated, an ESLint rule prevents anyone from regressing to the old `<Select>` without `SelectWithQuickCreate`.
- A new audit script `scripts/audit-empty-states.mjs` enumerates remaining unmigrated surfaces; CI prints the count on every PR.

---

## 9. Data models

### 9.1 Quick-create form values

Each form is dynamically typed from the registry:

```ts
type QuickCreateValues<E extends EntitySlug> = {
  [K in QuickCreateField<E>['name']]: InferFieldType<QuickCreateField<E>, K>
}
```

A small TypeScript helper infers the exact shape per entity, giving full type-safety in callers.

### 9.2 Server contract

Every quick-create endpoint MUST:

- Accept `Content-Type: application/json`.
- Return `201 Created` with the full record (not just the id).
- On validation failure, return `422 Unprocessable Entity` with field-level errors:
  ```json
  { "errors": [{ "field": "phone", "code": "invalid_format", "messageKey": "errors.phone.invalid" }] }
  ```
- On permission failure, return `403` with `{ "error": "permission_denied", "missing": "contacts.create" }`.

The dynamic-form's error rendering reads `errors[].field` and pins messages to the corresponding inputs.

---

## 10. Accessibility design

### 10.1 Focus management

- Modal: first input focuses on open via `autoFocus` on the first config field with `autoFocus: true`, default first field.
- Drawer: same.
- After modal closes via success: focus returns to the originating selector and immediately reads the new value.
- After modal closes via cancel: focus returns to the selector's input.

### 10.2 Screen-reader announcements

- Empty state appears: `role="status" aria-live="polite"` reads title + description.
- Modal opens: `role="dialog" aria-labelledby={titleId}`.
- Save success: a separate hidden region `aria-live="assertive"` announces "Customer 'Ali' created and selected."

### 10.3 Keyboard

- Tab cycles within the modal until Esc or save.
- Enter inside any input triggers Save.
- Shift+Tab from first input cycles to the last button (proper trap).

---

## 11. Testing strategy

| Test type | Where | What |
|-----------|-------|------|
| Unit | Vitest | Registry config, motion variants, field schema rendering |
| Integration | Vitest + Testing Library | `<EmptyState>` renders; CTA click fires telemetry; modal opens with right entity |
| Snapshot | Playwright | Each variant × each entity × each locale (visual diff) |
| E2E | Playwright | Full flow: open invoice → see empty customer dropdown → click CTA → fill modal → save → new customer selected |
| Telemetry | Vitest + mock RUM | Every event fires with correct attributes |
| Accessibility | axe-core (via Playwright) | Zero serious/critical violations on every surface |

---

## 12. Decisions and trade-offs

| ID | Decision | Rejected alternative | Reason |
|----|----------|---------------------|--------|
| D-001 | Single `<EmptyState>` component, variant prop | Separate components per variant | Lower bundle, single source for telemetry, easier to lint. |
| D-002 | Registry-driven, not per-call config | Per-call config in every `<Select>` | 14 places to update vs 42; consistency. |
| D-003 | Class A modal, Class B drawer, Class C navigate | Always modal | Information density: forcing a 15-field Item create into a 420px modal is hostile. |
| D-004 | Inline SVG illustrations | Image files | Better DX, smaller payload, theme-aware via CSS vars. |
| D-005 | Optimistic merge on success | Refetch on success | Save the round-trip; offline-friendly. |
| D-006 | Feature flag per-entity | Single global flag | Lets us roll back a problematic entity without retreating from all. |
| D-007 | Codemod-assisted migration | Hand-write each | 70% automation acceptable; full automation too risky. |
| D-008 | Search-empty distinct from data-empty | Same UI | Different cognitive model: empty-DB is "create one", search-empty is "clear or rephrase". |
| D-009 | Telemetry events to existing RUM | Separate analytics | Reuse infra; one dashboard. |
| D-010 | Lazy-load modal chunks | Always-loaded | Shell budget critical (≤ 350 KB); modals are conditional. |

---

## 13. Open questions

| OQ | Question | Resolve before |
|----|----------|----------------|
| OQ-1 | Should "Create '<query>' as new" search-empty CTA appear by default or be opt-in per entity? | Phase 2 start |
| OQ-2 | Where do we host the 8 illustration SVGs? Inline in bundle vs separate `/public/empty-states/` for CDN cache? | Phase 1 mid |
| OQ-3 | Do we need a dark-mode variant of the empty-state illustrations? (Theme today is light-only for most users.) | Phase 1 end |
| OQ-4 | Class B drawer: support multi-step Steps indicator from day one, or punt to Phase 4? | Phase 2 start |
| OQ-5 | Should the codemod auto-generate Playwright snapshot baselines, or require human verification? | Phase 2 start |

Each OQ has a one-week resolution SLA from its trigger date.

---

## 14. References

- Existing pattern reused: `frontend/src/design-system/EntitySelect.tsx` (generic structure)
- Existing pattern reused: `frontend/src/components/pos/POSCustomerSelector.tsx` (full implementation reference)
- Antd `Select.notFoundContent` and `dropdownRender` docs: https://ant.design/components/select
- Framer Motion useReducedMotion: https://www.framer.com/motion/use-reduced-motion/
- WCAG 2.1 SC 1.4.3, 1.4.11, 2.1.2, 2.4.7 (relevant for empty state + modal)

---

## 15. Out of scope

- The form-engine itself (assumed to exist as `<DynamicForm>` from prior work).
- Importer / CSV upload flows.
- Onboarding wizards.
- The Studio (user-defined entity) flow — Studio entities get their own pattern.
