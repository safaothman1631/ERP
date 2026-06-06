# Design-System Component Map & Recipes

Everything here is exported from `frontend/src/design-system/` (barrel: `index.ts`) and the
empty-state subsystem `frontend/src/design-system/empty/` (barrel: `empty/index.ts`). Import
from the barrel. **If a need below is covered, do not build a new component for it.**

## Table of contents
1. Layout & page chrome
2. Data display (tables, lists, KPIs, charts)
3. Forms & inputs
4. Empty / loading / error states + quick-create
5. Feedback, overlays & micro-components
6. Motion components
7. Print
8. Token reference (what to pull from `theme/tokens.ts`)
9. Recipe snippets

---

## 1. Layout & page chrome
| Component | Use when |
|---|---|
| `PageHeader` | Top of every page — title, subtitle, breadcrumb, action buttons |
| `DetailLayout` | Record/detail screens — tabbed (`DetailLayoutTab[]`), optional split pane |
| `FormLayout` | Any create/edit form — titled `FormSection`s; `useUnsavedChangesGuard` warns on nav-away |
| `SectionCard` | Group related fields/content into a titled card |
| `KeyValueGrid` | Read-only field display (`KeyValueItem[]`) — aligned label/value pairs, RTL-safe |
| `SkipToContent` | A11y skip link — include once per shell |
| `EnvironmentBadge` | "staging"/"dev" environment marker |

## 2. Data display
| Component | Use when |
|---|---|
| `DataTable` | **The** table. antd Table wrapper: sticky header, sortable/resizable cols, row hover quick-actions, `rowSelection`→`BulkActionBar`, `exportConfig`→`ExportMenu`, auto-virtualize ≥200 rows, built-in loading skeleton + empty state |
| `BulkActionBar` | Appears with `DataTable` row selection — batch ops (`BulkAction[]`) |
| `ColumnVisibility` | Show/hide/reorder table columns |
| `ExportMenu` | CSV/XLSX/PDF export trigger |
| `KpiCard` | Dashboard metric tile (value, delta, sparkline) |
| `ChartCard` | Card wrapper for a chart with hover micro-interaction |
| `TrendChart` / `MiniSparkline` | Line/area trends; inline sparkline. Colors from `dataViz` |
| `StatusTag` | Status pill — `StatusKind` maps to semantic `status` tokens + icon (never color-only) |
| `MoneyDisplay` | Render currency (IQD, Arabic-Indic digits, U+066C grouping) read-only |
| `Timeline` | Activity/audit history |
| `AvatarGroup` | Stacked user avatars (`AvatarItem[]`) |

## 3. Forms & inputs
| Component | Use when |
|---|---|
| `EntitySelect` | Async-loading select for contacts/items/accounts/etc. (`EntityOption`) |
| `SelectWithQuickCreate` | Select that lets the user create the missing record inline — see §4 |
| `UserSelect` | Pick a user/team member (`UserOption`) |
| `MoneyInput` | Currency amount entry — `InputNumber` + currency suffix |
| `AddressInput` | Iraqi address; exports `IRAQ_GOVERNORATES` |
| `PhoneInput` | Phone entry, normalizes to +964 / E.164 |
| `DateRangePickerRTL` | Date ranges — RTL-correct (don't use raw antd RangePicker) |
| `EditableLineItems` | Editable line-item table (invoices/POs) — `LineItemColumn[]` |
| `InlineEdit` | Click-to-edit a single field in place |
| `FileUploader` | File attachment upload |
| `SaveSplitButton` | Submit button with "save / save & new / save & close" (`SaveAction[]`) |

## 4. Empty / loading / error + quick-create  (`design-system/empty/`)
The anti-dead-end system. A user who opens a selector with no records can create one *without
leaving the form*. Heavy modal/drawer/form chunks are **lazy-loaded** — keep it that way.

| Export | Use when |
|---|---|
| `StateSwitch` | Wrap any data surface — switches between loading/empty/error/populated |
| `EmptyState` | Illustration + headline + CTA. `variant`: `selector`/`list`/`drawer`/`subform`/`search` |
| `LoadingState` / `LoadingSkeleton` | Skeleton that matches final layout — **not** a bare spinner |
| `ErrorState` / `PageErrorState` | Data-fetch failure with retry |
| `SelectWithQuickCreate` | Dropdown whose "no results" offers inline create for an `EntitySlug` |
| `ListWithEmptyState` | List page with a first-run empty state + CTA |
| `SubformWithEmptyState` / `RelatedDataPanel` | Empty states for nested/related sections |
| `EmptyStateIllustration` | 8 inline SVG illustrations (`IllustrationKey`) |
| `useEmptyStateTelemetry` | Emit empty-state interaction events |

Quick-create is registry-driven: entities live in `data/quickCreateRegistry.ts`, typed by
`EntitySlug` (`customer`, `vendor`, `item`, `account`, `tax_rate`, `currency`, `tag`,
`payment_method`, `bank_account`, `team`, `subscription_plan`, `location`, `employee`, …).
Adding quick-create for a new entity = add the slug to `EntitySlug` + an entry in the registry,
**not** a new component. Permission-gate CTAs with `PermissionGate` / `usePermission`.

## 5. Feedback, overlays & micro-components
| Component | Use when |
|---|---|
| `ConfirmDialog` | The **only** modal for destructive confirms |
| `toast` (+ `useToastBridge`) | Transient success/error notifications |
| `ConnectionStatus` | Online/offline/syncing indicator (critical for offline-first POS) |
| `ContextMenu` | Right-click / overflow actions (`ContextMenuItem[]`) |
| `QuickSearch` | Command-palette-style search |
| `KbdHint` (+ `cmdKey`) | Render keyboard-shortcut hints (⌘/Ctrl aware) |
| `ShortcutCheatsheet` | The "?" shortcuts overlay (`Shortcut[]`) |
| `CopyButton` | Copy-to-clipboard for IDs/codes |
| `FilterBar` / `FilterChipTray` / `AdvancedFilterDrawer` / `SavedViewsPicker` | List filtering stack |
| `Stepper` | Multi-step flows / wizards |
| `OptimizedImage` | Any image — WebP, lazy, responsive sizes |

## 6. Motion components (framer-motion)
`PageTransition`, `MotionModal` (+ `MotionModalContent`), `AnimatedList` (+ `AnimatedListItem`),
`MotionButton`. Variants from `utils/animations`: `pageVariants`, `modalVariants`,
`listVariants`, `itemVariants`, `pressAnimation`, `hoverLift`, **and their reduced-motion twins**
(`reducedPageVariants`, `reducedModalVariants`). Empty-system motion tokens in `empty/motion`
(`SPRING_GENTLE`, `SPRING_TACTILE`, `DURATION_FAST/NORMAL/SLOW`, `STAGGER_DELAY`).

## 7. Print  (`design-system/print/`)
`PrintView` / `usePrint` + `InvoicePrintTemplate`, `QuotePrintTemplate`, `BillPrintTemplate`,
`PurchaseOrderPrintTemplate`, `ReceiptPrintTemplate`, `BasePrintTemplate`. Types in
`print/types.ts` (`PrintDocument`, `CompanyInfo`, `DocumentLineItem`, …).

## 8. Token reference (`frontend/src/theme/tokens.ts`)
Pull from these — never hardcode:
- **Color:** `palette` (`primary50–900` brand `#1F6FEB`; `success`/`warning`/`danger`/`info`
  scales; `gray`/`ink`; dark variants), `status` (fg/bg/border/hover per state), `dataViz`
  (`categorical`/`sequential`/`diverging` for charts).
- **Spacing:** `spacing` (4px grid, numeric `spacing[4]===16`) or named `space` (`xs`…`xxxl`).
- **Shape:** `radius` (`md:10` controls, `lg:14` cards/modals, `pill`), `shadow` + `elevation`
  (light + `.dark`).
- **Type:** `typography` semantic ramp (`display`/`h1`/`h2`/`h3`/`body`/`caption`/`overline`),
  `fontSize`, `fontWeight`, `lineHeight`, `fontFamily` (`rtl`: Vazirmatn/Noto; `ltr`: Inter).
- **Motion:** `duration` (`fast:150`/`normal:250`/`slow:400`), `easing`, `transitions`.
- **System:** `zIndex` scale, `layout` (topbar/sidebar/footer/page-padding/`contentMaxWidth:1440`),
  `a11y` (`minTouchTarget:44`, focus ring), `Density` type + `densityPagePadding`.
- **Glass:** `glass` surface tokens + `getGlassStyle(mode, blur, surface)` for overlays
  (topbar, palette, login, modal, drawer, card, popover, toast) — with a solid fallback for
  `@supports not (backdrop-filter)`. There's an `audit:glass-modals` script; use the helper,
  don't roll your own blur.
- **AntD bridge:** `buildAntTokens(mode, density, isRTL)` / `buildAntComponents(mode)` already
  feed `AppConfigProvider`. You normally never call these — just rely on the global theme.

## 9. Recipe snippets

**List page**
```tsx
import { PageHeader, FilterBar, DataTable } from '@/design-system';
// inside component:
<>
  <PageHeader title={t('invoices.title')} actions={<MotionButton type="primary" onClick={create}>{t('common.new')}</MotionButton>} />
  <FilterBar filters={filterDefs} value={filters} onChange={setFilters} />
  <DataTable
    columns={columns}
    dataSource={data ?? []}
    loading={isLoading}
    rowSelection
    onBulkAction={handleBulk}
    exportConfig={{ onExport: handleExport }}
  />
</>
```

**Form page**
```tsx
import { FormLayout, SelectWithQuickCreate, MoneyInput, SaveSplitButton } from '@/design-system';
const guard = useUnsavedChangesGuard(form.isFieldsTouched());
<FormLayout
  sections={[{ key: 'general', title: t('items.general'), content: (
    <>
      <Form.Item name="income_account_id" label={t('items.incomeAccount')}>
        <SelectWithQuickCreate entity="account" />
      </Form.Item>
      <Form.Item name="rate" label={t('items.rate')}><MoneyInput /></Form.Item>
    </>
  )}]}
  footer={<SaveSplitButton onSave={submit} />}
/>
```

**Money & status (read-only)**
```tsx
import { MoneyDisplay, StatusTag } from '@/design-system';
<MoneyDisplay amount={invoice.total} currency="IQD" />
<StatusTag kind={invoice.status} />   // 'paid' | 'draft' | 'overdue' | ...
```

**Lazy-load a heavy overlay (keep the shell small)**
```tsx
const QuickCreateDrawer = React.lazy(() => import('@/design-system/empty/QuickCreateDrawer'));
// render inside <Suspense fallback={<LoadingState />}>
```
