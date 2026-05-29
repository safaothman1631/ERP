# Persistent Quick-Create CTA — Design

## Architecture diagram (text)

```
┌─────────────────────────────────────────────────┐
│  <Select> (Antd 6)                              │
│  ┌──────────────────────────────────────────┐   │
│  │ Search input  …                          │   │
│  ├──────────────────────────────────────────┤   │
│  │                                          │   │
│  │   ▼ POPUP (popupRender owns this) ▼      │   │
│  │                                          │   │
│  │   ┌────────────────────────────────┐     │   │
│  │   │  STATE-SWITCH BODY             │     │   │
│  │   │  • loading   → <LoadingState>  │     │   │
│  │   │  • error     → <ErrorState>    │     │   │
│  │   │  • empty     → <EmptyState>    │     │   │
│  │   │                 (no inline CTA)│     │   │
│  │   │  • search-empty → search empty │     │   │
│  │   │  • populated → <originNode>    │     │   │
│  │   │                (Antd option    │     │   │
│  │   │                 list)          │     │   │
│  │   └────────────────────────────────┘     │   │
│  │   ──────────  divider  ───────────       │   │
│  │   ┌────────────────────────────────┐     │   │
│  │   │  PERSISTENT FOOTER             │     │   │
│  │   │  [+] Add <entity>     ──►      │     │   │
│  │   │  (hidden if disabled or no     │     │   │
│  │   │   permission)                  │     │   │
│  │   └────────────────────────────────┘     │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## The single component change

### Today (excerpt)

```tsx
<Select
  ...
  notFoundContent={notFoundContent}
  // ^ rendered only when zero options match. Contains the empty body
  //   AND, for the empty variant, the inline primaryAction CTA.
/>
```

### Tomorrow

```tsx
<Select
  ...
  popupRender={(originNode) => (
    <QuickCreatePopup
      entity={entity}
      config={config}
      originNode={originNode}
      state={derivedState}        // loading / error / empty / search-empty / populated
      ctaAction={ctaAction}
      footerVisible={footerVisible} // disabled + permission gate
      searchValue={debouncedSearch}
      onClearSearch={() => setSearch('')}
      onRetry={...}
    />
  )}
  // notFoundContent left at default (Antd's "No data") because the
  // popupRender path now owns the empty body — Antd will only fall back
  // to notFoundContent if popupRender is undefined.
/>
```

`QuickCreatePopup` is a new internal component co-located in the
same file. It owns:

- the state-switch (re-uses `<StateSwitch>`, `<LoadingState>`,
  `<ErrorState>`, `<EmptyState>` from the design-system barrel),
- the divider,
- the footer button row.

The footer row is rendered via a small `QuickCreateFooter`
sub-component (also in the same file) so the JSX is readable.

## State → render matrix

| `derivedState`     | Body rendered                               | Footer rendered? |
|--------------------|---------------------------------------------|:----------------:|
| `loading`          | `<LoadingState variant="selector" rows={2}/>` | yes              |
| `error`            | `<ErrorState onRetry={...}/>`               | yes              |
| `empty` (no search)| `<EmptyState illustration title description/>` **without** `primaryAction` | yes              |
| `search-empty`     | `<EmptyState variant="search" .../>` with **"Clear search"** action | yes              |
| `populated`        | `originNode` (the Antd option list, possibly virtualized) | yes              |
| `disabled`         | `originNode` (Antd renders disabled list)   | **no**           |
| `permission-blocked` | `originNode` (same as populated/empty)    | **no**           |

`derivedState` is computed by the existing logic plus the disabled
and permission flags. The permission check is read from the
already-mounted `usePermission(config.permission)`.

## The footer

### Markup

```tsx
<div
  className="qc-select-footer"
  role="presentation"     // contains a single button; button owns the a11y semantics
  dir="auto"              // RTL-respecting; html dir attribute also applies
>
  <button
    type="button"
    className="qc-select-footer__cta"
    onClick={ctaAction.onClick}
    onKeyDown={onFooterKeyDown}  // Enter/Space → onClick
    aria-label={t(ctaAction.labelKey, { entity })}
    data-testid={`select-quick-create-footer-${entity}`}
  >
    <PlusOutlined aria-hidden="true" />
    <span>{t(ctaAction.labelKey, ctaAction.context)}</span>
  </button>
</div>
```

Note: a plain `<button>` is intentional — Antd's `<Button>` inside
`popupRender` can swallow keyboard events because the Select's
keyboard handler wraps the popup. A vanilla button keeps focus
management predictable.

### Styling (added to `EmptyState.css`)

```css
/* Persistent footer at the bottom of every SelectWithQuickCreate popup. */
.qc-select-footer {
  display: flex;
  padding: 8px 12px;
  border-top: 1px solid var(--qc-border-subtle, rgba(0, 0, 0, 0.06));
  background: var(--qc-surface-elevated, #fafafa);
  /* Stick to bottom so a tall option list doesn't push it out of view. */
  position: sticky;
  bottom: 0;
}

.qc-select-footer__cta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  padding: 4px 8px;
  border: none;
  background: transparent;
  color: var(--ant-color-primary, #1677ff);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 6px;
  text-align: start; /* RTL-aware */
}

.qc-select-footer__cta:hover,
.qc-select-footer__cta:focus-visible {
  background: var(--ant-color-primary-bg, rgba(22, 119, 255, 0.08));
  outline: none;
}

.qc-select-footer__cta:focus-visible {
  box-shadow: 0 0 0 2px var(--ant-color-primary-bg-active, rgba(22, 119, 255, 0.2));
}

/* RTL: keep icon right of text; `flex-direction: row` already honors `dir`,
 * but the `text-align: start` rule on the label inside ensures the label
 * itself starts from the correct side. */
[dir="rtl"] .qc-select-footer__cta {
  text-align: start;
}
```

CSS variables fall back to hard-coded values so the rule works
outside the AntD design-token provider too (e.g. in tests).

## Telemetry

`useEmptyStateTelemetry` already exposes a `track('cta_click', {entity, surface, ...})` API. Extend the payload object to carry an optional `source: 'footer' | 'body'` discriminator:

```ts
track('cta_click', {
  entity,
  surface: 'selector',
  source: 'footer',   // new; 'body' for the rare cases we ever keep an inline CTA
});
```

Existing dashboards that read `entity` + `surface` continue working.
The new `source` field is additive; downstream analytics can split
funnels by entry point.

## Permission gate

The existing `usePermission(resource)` hook backs the body CTA's
`permissionGate`. Re-use the same hook at the popup level:

```ts
const canCreate = usePermission(config.permission.split('.')[0]);
const footerVisible = !disabled && canCreate && Boolean(config);
```

`Boolean(config)` is the existing graceful-degrade: if the entity is
not in the registry (e.g. a future vertical-specific slug), the
component currently logs and returns a plain Antd Select — the
footer simply doesn't appear in that path.

## Edge cases

### 1. Multi-select (`mode="multiple"`, `mode="tags"`)

`popupRender` semantics are identical. The footer click still fires
`handleCtaClick`, which opens the modal/drawer. On save, the new
record's id is appended to `selected` rather than replacing it.
This is the existing optimistic-merge code path — no change needed.

### 2. Virtualized option lists

Antd 6 virtualizes option lists internally when there are many
options. `popupRender` wraps the virtualized container in its
`originNode` argument, so the divider and footer render OUTSIDE the
virtualization scroller — they remain visible regardless of scroll
position. The `position: sticky; bottom: 0` rule keeps the footer
pinned within the popup viewport.

### 3. Class C entities (`navigate` instead of modal/drawer)

`ctaAction.onClick` for Class C entities (currently only
`employee`) is wired to `saveReturnContext()` + `navigate()`. The
footer reuses the same handler — clicking it saves the return token
and navigates away from the form. The user comes back to the same
form via the existing return-context flow. Unchanged.

### 4. `ctaOverride` prop

When a call site passes `ctaOverride`, the existing code already
short-circuits the registry's CTA. The footer reads
`ctaAction.labelKey` and `ctaAction.onClick` from the same composed
`ctaAction` object — so the override flows through.

### 5. Disabled

When the parent passes `disabled={true}`, the Antd Select is
non-interactive and the popup may still open (depending on Antd
internals). Defensively, we still call `popupRender` with the
disabled-aware `footerVisible=false` so the footer is omitted. This
mirrors the existing body-CTA permission gate logic.

### 6. Search-empty footer label

When the user types a query, the body shows search-empty with a
"Clear search" link. The footer still says "+ Add <entity>". This
is intentional: the user might want to **create** the thing they
searched for. We could (future enhancement) prefill the
quick-create form's name field with the search query, but that's a
separate spec.

### 7. Tests

Vitest renders the component in jsdom. `popupRender` fires the same
way; the only setup change is that the test must call
`fireEvent.mouseDown(select)` to open the popup, then assert on
`getByTestId('select-quick-create-footer-customer')`.

### 8. Keyboard

Antd Select traps `Tab` inside the popup when open. We rely on
Antd's default focus management: arrow keys navigate options,
`Tab` lands on focusable elements within `popupRender` content
(our footer button is focusable). `Enter` triggers `onClick`. We do
**not** override any of Antd's keyboard handlers.

### 9. Scrolling option list past footer

The footer is `position: sticky; bottom: 0`. Even with 50 options
and overflow scroll, the footer remains visible. This matches
Notion / Linear / Airtable behaviour.

### 10. RTL

`text-align: start` and Antd's existing RTL handling (the
ConfigProvider direction) flip the layout. The icon stays on the
correct side. We test in en / ku / ar in the dev gallery.

## Migration plan

This is a pure component change. No call site edits. Phased rollout
is not necessary — the change is monotonic improvement and behind
no flag (the parent `ui.empty_state_v2` flag was removed in the
previous spec).

If we wanted a kill switch: gate the new footer on
`isEmptyStateV2Enabled(entity)` so per-entity disable still works
in an emergency. The existing override map is already wired —
adding a one-line check costs nothing. We DO add this defensive
gate.

## Verification matrix

| Surface                                  | Verified by                          |
|------------------------------------------|--------------------------------------|
| Empty dropdown (zero records)            | Manual smoke + Vitest                |
| Populated dropdown (≥ 1 record)          | Manual smoke + Vitest                |
| Searching with results                   | Manual smoke                         |
| Searching with no results (search-empty) | Manual smoke + Vitest                |
| Loading state                            | Manual smoke                         |
| Error state (force network failure)      | Manual smoke                         |
| Multi-select mode                        | Manual smoke (Bills.tsx tags, if any) |
| Disabled Select                          | Manual smoke + Vitest                |
| Permission-blocked role                  | Manual smoke with non-admin role     |
| Keyboard: Tab to footer, Enter to fire   | Manual smoke + Vitest                |
| RTL: ku / ar                             | Manual smoke in browser              |
| Telemetry: `cta_click` fires once        | Vitest + dev-gallery RUM panel       |
| Antd deprecation removed                 | grep console output after dev refresh |

## Rollback

Revert the single commit that touches
`SelectWithQuickCreate.tsx` + `EmptyState.css`. All call sites
remain on the prior (still-correct) behaviour. No data migration,
no Firestore changes, no feature flag flip required.
