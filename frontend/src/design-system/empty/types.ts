/**
 * @file types.ts
 * @description Public TypeScript contract for the empty-state + quick-create system.
 *
 * This module is intentionally type-only — it has no runtime cost. All other
 * primitives in `frontend/src/design-system/empty/` import from here.
 *
 * Spec: `.kiro/specs/empty-state-quick-create/requirements.md` §4, §5.
 * Design: `.kiro/specs/empty-state-quick-create/design.md` §1, §2.
 */

import type { CSSProperties, ReactNode } from 'react';
import type { QueryClassName } from '../../data/queryClasses';

/* ---------------------------------------------------------------------------
 * Entity slugs — the 14+ entities supported by the registry.
 * Adding a new slug here is the FIRST step to adding quick-create support.
 * ---------------------------------------------------------------------------
 */

/**
 * Identifier of an entity supported by the quick-create registry.
 * MUST match a key in `QUICK_CREATE_REGISTRY` at runtime.
 */
export type EntitySlug =
  // Class A — modal-friendly (≤ 5 required fields)
  | 'customer'
  | 'vendor'
  | 'tax_rate'
  | 'expense_category'
  | 'equipment_category'
  | 'currency'
  | 'tag'
  | 'payment_method'
  // Class B — drawer-friendly (5–15 fields)
  | 'item'
  | 'account'
  | 'bank_account'
  | 'team'
  | 'subscription_plan'
  | 'location'
  // Class C — navigate with return-token
  | 'employee';

/* ---------------------------------------------------------------------------
 * Illustrations
 * ---------------------------------------------------------------------------
 */

/** One of the 8 inline SVG illustration keys. */
export type IllustrationKey =
  | 'customers'
  | 'items'
  | 'documents'
  | 'money'
  | 'inbox'
  | 'chart'
  | 'box'
  | 'lock';

/* ---------------------------------------------------------------------------
 * Empty-state variants
 * ---------------------------------------------------------------------------
 */

/**
 * Visual variant of the empty state.
 *
 * - `selector` — dense, fits inside a dropdown's `notFoundContent`.
 * - `list`     — full-canvas, 96px illustration, used inside list pages.
 * - `drawer`   — inside a side panel / drawer.
 * - `subform`  — inline at a section position inside a parent form.
 * - `search`   — search-with-no-matches (distinct from collection-empty).
 */
export type EmptyStateVariant = 'selector' | 'list' | 'drawer' | 'subform' | 'search';

/* ---------------------------------------------------------------------------
 * Permission gate
 * ---------------------------------------------------------------------------
 */

/**
 * Permission descriptor in `resource.verb` form (e.g. `contacts.create`).
 * Routed through `usePermission().hasPerm()` for evaluation.
 */
export interface PermissionGate {
  /** Either a `resource.verb` string or split parts. */
  resource: string;
  verb: string;
}

/* ---------------------------------------------------------------------------
 * Action descriptors
 * ---------------------------------------------------------------------------
 */

/** Primary or secondary action button on an empty state. */
export interface EmptyStateAction {
  /** i18n key resolved against the active namespace at render time. */
  labelKey: string;
  /** Click handler — fires AFTER telemetry. */
  onClick: () => void;
  /** Optional icon, typically `<PlusOutlined />`. */
  icon?: ReactNode;
  /** When true, the button renders disabled (e.g. while a mutation runs). */
  disabled?: boolean;
}

/* ---------------------------------------------------------------------------
 * EmptyState props
 * ---------------------------------------------------------------------------
 */

/** Telemetry context — opaque attribution attached to every emitted event. */
export type EmptyStateContext = Record<string, unknown>;

/**
 * Public prop surface for `<EmptyState>`.
 *
 * @see Requirement 4.1
 */
export interface EmptyStateProps {
  variant: EmptyStateVariant;
  illustration: IllustrationKey;
  /** i18n key for the title (resolved via `useTranslation`). */
  titleKey: string;
  /** i18n key for the 1-line description. */
  descriptionKey: string;
  /** Optional explicit title override (use sparingly — prefer titleKey). */
  title?: ReactNode;
  /** Optional explicit description override. */
  description?: ReactNode;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  /** Permission gate — replaces primaryAction with a Request-access link. */
  permissionGate?: PermissionGate;
  /** Telemetry context — forwarded with every event. */
  context?: EmptyStateContext;
  /** Entity slug — for telemetry attribution; optional outside registry use. */
  entity?: EntitySlug | string;
  /** Optional aria-label override. */
  ariaLabel?: string;
  /** Optional className for layout customisation. */
  className?: string;
}

/* ---------------------------------------------------------------------------
 * StateSwitch props
 * ---------------------------------------------------------------------------
 */

/**
 * Props for `<StateSwitch>`. Defines the deterministic loading → empty | populated | error
 * state machine (Requirement 7.2).
 */
export interface StateSwitchProps {
  loading: boolean;
  error: unknown;
  empty: boolean;
  populated: ReactNode;
  loadingState?: ReactNode;
  errorState?: ReactNode;
  emptyState: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Loading / Error state props
 * ---------------------------------------------------------------------------
 */

export interface LoadingStateProps {
  /** Number of skeleton rows to render (default 5). */
  rows?: number;
  /** Variant influences padding and skeleton sizing. */
  variant?: EmptyStateVariant;
  /** Optional className. */
  className?: string;
}

export interface ErrorStateProps {
  /** Optional Error instance or string; used to derive a developer hint. */
  error?: unknown;
  /** Retry handler — invoked when the user clicks the Retry button. */
  onRetry?: () => void;
  /** Variant influences padding. */
  variant?: EmptyStateVariant;
  /** Optional className. */
  className?: string;
  /** Optional aria-label override. */
  ariaLabel?: string;
}

/* ---------------------------------------------------------------------------
 * Dynamic-form field schemas (registry-driven)
 * ---------------------------------------------------------------------------
 */

/**
 * Supported field types in the quick-create dynamic form.
 * Mirrors the small surface of inputs Antd renders well in a compact modal.
 */
export type FieldType =
  | 'text'
  | 'tel'
  | 'email'
  | 'number'
  | 'select'
  | 'textarea'
  | 'file';

/** Option entry for a select field — labels are i18n keys. */
export interface FieldOption<V extends string | number = string> {
  value: V;
  labelKey?: string;
  /** Raw label, used when no i18n key is supplied (e.g. dynamic options). */
  label?: string;
}

/**
 * Definition of one field in the registry's dynamic form.
 *
 * `name` corresponds to the property posted to the server in `apiCreate`.
 */
export interface FieldDef<V = unknown> {
  name: string;
  type: FieldType;
  /** True when the field MUST be supplied. */
  required?: boolean;
  /** i18n key for the field label. */
  labelKey: string;
  /** Optional i18n key for placeholder text. */
  placeholderKey?: string;
  /** When true, the modal focuses this field on open. */
  autoFocus?: boolean;
  /** Default value — used to seed `useState`. */
  default?: V;
  /** For `select` fields: the dropdown options. */
  options?: ReadonlyArray<FieldOption<string | number>>;
  /** For `number` fields: min. */
  min?: number;
  /** For `number` fields: max. */
  max?: number;
  /** For `number` fields / suffix display: a trailing unit like `%`. */
  suffix?: string;
  /** For `text` fields: max length. */
  maxLength?: number;
  /** For `file` fields: accept attribute. */
  accept?: string;
  /** When true, the field renders disabled (server-derived). */
  disabled?: boolean;
  /** Optional help text i18n key, rendered under the field. */
  helpKey?: string;
}

/* ---------------------------------------------------------------------------
 * Quick-create configuration
 * ---------------------------------------------------------------------------
 */

/** Class of an entity per design.md §2.2. */
export type EntityClass = 'A' | 'B' | 'C';

/** Form values keyed by field name. */
export type QuickCreateValues = Record<string, unknown>;

/** Result returned by `apiCreate` — minimal contract the registry guarantees. */
export interface QuickCreateResult<T = unknown> {
  /** Stable identifier of the newly-created record (used for optimistic select). */
  id: string | number;
  /** Display label — what the originating selector shows after auto-select. */
  label: string;
  /** Full server-returned record, opaque to the framework but useful to callers. */
  raw: T;
}

/** Context passed to `apiCreate` — currently just an AbortSignal. */
export interface ApiCreateContext {
  signal?: AbortSignal;
}

/**
 * Lazy-loaded options fetcher for selectors. Returns options matching the
 * (possibly empty) search query.
 */
export interface LoadOptionsResult {
  options: Array<{ value: string | number; label: string }>;
}

/**
 * Query-inheritance hint: when the user types a query in the selector before
 * clicking Create, the system pre-fills `field` with the query string. If
 * the query matches a `detectors` pattern (e.g. an email regex), the system
 * routes it to that field instead.
 */
export interface QueryInheritance {
  /** Default field to pre-fill (typically `display_name` or `name`). */
  field: string;
  /**
   * Ordered list of alternate detectors. Each entry pairs a regex with the
   * field to route the query to when the regex matches.
   */
  detectors?: Array<{ field: string; pattern: RegExp }>;
}

/**
 * Registry entry — one per entity. The registry is the SINGLE source of truth
 * for quick-create behavior; consumers never inline a config.
 */
export interface QuickCreateConfig<T = unknown> {
  /** UI class: modal | drawer | navigate. */
  class: EntityClass;
  /** i18n key for the modal/drawer title. */
  titleKey: string;
  /** i18n key for the empty-state title rendered above the CTA. */
  emptyTitleKey?: string;
  /** i18n key for the empty-state description. */
  descriptionKey: string;
  /** i18n key for the primary CTA label. */
  ctaKey: string;
  /** Illustration identifier. */
  illustration: IllustrationKey;
  /** Field schema rendered by `<DynamicForm>`. */
  fields: ReadonlyArray<FieldDef>;
  /**
   * Creates the entity server-side. MUST return a `{ id, label, raw }` triple.
   * On error: throw — the modal catches and renders inline errors.
   */
  apiCreate: (values: QuickCreateValues, ctx: ApiCreateContext) => Promise<QuickCreateResult<T>>;
  /**
   * Loads options for the originating selector. Receives the current search
   * query string. Should be debounced server-side or in the caller.
   */
  loadOptions: (search: string) => Promise<LoadOptionsResult>;
  /** React-Query freshness class for selector option fetches. */
  queryClass: QueryClassName;
  /** Server permission required to create — UI gates via `hasPerm`. */
  permission: string;
  /** Full create form route — used by the "Full form…" link. */
  fullFormHref: string;
  /** Optional query-inheritance config. Defaults to `{ field: 'name' }`. */
  queryInheritance?: QueryInheritance;
}

/* ---------------------------------------------------------------------------
 * Modal / Drawer props
 * ---------------------------------------------------------------------------
 */

/** Prefill payload passed from the originating selector to the quick-create UI. */
export interface QuickCreatePrefill {
  /** Original search query that triggered the create. */
  search?: string;
  /** Direct field overrides applied on top of registry defaults. */
  fields?: Partial<QuickCreateValues>;
}

/** Props shared by `<QuickCreateModal>` and `<QuickCreateDrawer>`. */
export interface QuickCreateUIProps {
  entity: EntitySlug;
  open: boolean;
  onClose: () => void;
  onSuccess: (result: QuickCreateResult) => void;
  prefill?: QuickCreatePrefill;
  /** Optional context forwarded to telemetry events. */
  context?: EmptyStateContext;
}

/* ---------------------------------------------------------------------------
 * Higher-order patterns
 * ---------------------------------------------------------------------------
 */

/** Props for `<SelectWithQuickCreate>`. */
export interface SelectWithQuickCreateProps {
  entity: EntitySlug;
  value?: string | number | null;
  onChange?: (value: string | number | null, raw?: unknown) => void;
  /** Optional override for the registry-provided loadOptions. */
  loadOptions?: (search: string) => Promise<LoadOptionsResult>;
  /**
   * Optional static options override. When provided, the component skips the
   * registry's `loadOptions` fetch and uses these directly. Migrations that
   * already had the options in local state (e.g. `TicketsList.team_id`)
   * forward them here for a no-op behavioural swap.
   * Shape matches `LoadOptionsResult.options` (plain `{ value, label }`).
   */
  options?: Array<{ value: string | number; label: string }>;
  /** Pre-fill the typed search query into the modal (default true). */
  prefillFromSearch?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Optional override for the empty CTA — defaults to registry CTA. */
  ctaOverride?: EmptyStateAction;
  /** Forwarded to Antd `<Select>`. */
  allowClear?: boolean;
  /** Forwarded to Antd `<Select>` — style override. */
  style?: CSSProperties;
}

/**
 * Props for `<ListWithEmptyState>`.
 *
 * Note: the canonical, fully-typed shape (with `entity: EntitySlug | string`
 * + `searchQuery` + copy overrides) lives on the component itself in
 * `ListWithEmptyState.tsx`. This type is the minimal contract surface for
 * consumers that prefer to import props from `types.ts`. Prefer
 * `import type { ListWithEmptyStateProps } from '@/design-system/empty/ListWithEmptyState'`
 * for the full shape.
 */
export interface ListWithEmptyStateProps<TRow> {
  entity: EntitySlug | string;
  data: TRow[] | undefined;
  loading: boolean;
  error?: unknown;
  /** Render-prop that receives the populated rows and returns the table JSX. */
  render: (rows: TRow[]) => ReactNode;
  /** Optional retry handler — defaults to no-op. */
  onRetry?: () => void;
  /** Optional CTA override; defaults to registry CTA opening the modal/drawer. */
  ctaOverride?: EmptyStateAction;
  /** Optional className. */
  className?: string;
  /** Optional context forwarded to telemetry. */
  context?: EmptyStateContext;
}

/** Props for `<SubformWithEmptyState>`. */
export interface SubformWithEmptyStateProps {
  entity: EntitySlug | string;
  /**
   * EP-0 API: true when the parent's subform has zero rows. Prefer this for
   * new code. If omitted, falls back to the legacy `items` prop.
   */
  empty?: boolean;
  /** EP-0 API: render the populated subform when `empty === false`. */
  children?: ReactNode;
  /** EP-0 API: CTA fires when the user clicks "+ Add first item". */
  onAdd?: () => void;
  /** Optional i18n key for the empty title; defaults to a generic key. */
  titleKey?: string;
  /** Optional i18n key for the description. */
  descriptionKey?: string;
  /** Optional i18n key for the CTA label. */
  ctaKey?: string;
  /** Optional illustration override. */
  illustration?: IllustrationKey;
  className?: string;
  /* ── Legacy EP-5 shim props (back-compat) ───────────────────────────── */
  /** Legacy: rows array; emptiness derived from `items.length === 0`. */
  items?: unknown[];
  /** Legacy: alias for `onAdd`. */
  onAddFirst?: () => void;
  /** Legacy: function-style render — returns populated subform JSX. */
  render?: () => ReactNode;
  /** Legacy: empty-state title i18n key. Aliased to `titleKey`. */
  emptyTitleKey?: string;
  emptyTitleFallback?: string;
  /** Legacy: empty-state description i18n key. Aliased to `descriptionKey`. */
  emptyDescriptionKey?: string;
  emptyDescriptionFallback?: string;
  /** Legacy: empty-state CTA i18n key. Aliased to `ctaKey`. */
  emptyCtaKey?: string;
  emptyCtaFallback?: string;
  /** Legacy: empty-state icon override. */
  icon?: ReactNode;
}

/** Props for `<RelatedDataPanel>`. */
export interface RelatedDataPanelProps<T = unknown> {
  /** Entity slug — used for telemetry context and auto-derived i18n keys. */
  entity?: EntitySlug | string;
  /** Title shown above the data — i18n key OR ReactNode. */
  titleKey?: string;
  title?: ReactNode;
  /**
   * EP-0 API: true when the related collection has zero entries. If omitted,
   * falls back to the legacy `data` prop.
   */
  empty?: boolean;
  /** EP-0 API: rendered when `empty === false`. */
  children?: ReactNode;
  /** Optional empty-state description i18n key. */
  emptyDescriptionKey?: string;
  /** Optional illustration; defaults to `inbox`. */
  illustration?: IllustrationKey;
  /** Optional secondary CTA — related panels rarely have a primary CTA. */
  secondaryAction?: EmptyStateAction;
  className?: string;
  /* ── Legacy EP-5 shim props (back-compat) ───────────────────────────── */
  /** Legacy: rows array; emptiness derived from `data == null || data.length === 0`. */
  data?: T[] | null;
  /** Legacy: skeleton-while-loading flag. */
  loading?: boolean;
  /** Legacy: empty-state title i18n key alias. */
  emptyTitleKey?: string;
  emptyTitleFallback?: string;
  /** Legacy: empty-state description fallback string. */
  emptyDescriptionFallback?: string;
  /** Legacy: empty-state primary CTA i18n key. */
  emptyCtaKey?: string;
  emptyCtaFallback?: string;
  /** Legacy: empty-state primary CTA handler. */
  onEmptyCta?: () => void;
  /** Legacy: empty-state icon override. */
  icon?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Return-context helper — re-exported from `utils/returnContext.ts` for callers
 * that prefer to import everything from the empty/* barrel.
 * ---------------------------------------------------------------------------
 */
export type { ReturnContextPayload } from '../../utils/returnContext';
