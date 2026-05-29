/**
 * @file index.ts
 * @description Barrel for the empty-state + quick-create system.
 *
 * Tree-shakable: heavy chunks (`QuickCreateModal`, `QuickCreateDrawer`,
 * `DynamicForm`) are NOT re-exported by default — `<SelectWithQuickCreate>`
 * and `<ListWithEmptyState>` import them lazily so the shell stays under the
 * 8 KB gzipped budget (Requirement 13.1).
 *
 * Consumers that want to dynamically import them can still do so:
 *   const { QuickCreateModal } = await import('@/design-system/empty/QuickCreateModal')
 *
 * Re-exported here:
 *   - Primitives:   `EmptyState`, `StateSwitch`, `LoadingState`, `ErrorState`,
 *                   `EmptyStateIllustration`
 *   - HOCs:         `SelectWithQuickCreate`, `ListWithEmptyState`,
 *                   `SubformWithEmptyState`, `RelatedDataPanel`
 *   - Motion:       `SPRING_GENTLE`, variants
 *   - Types:        everything in `./types`
 */

/* ── Primitives (always-loaded; in shell bundle) ─────────────────────── */
export { EmptyState } from './EmptyState';
export { EmptyStateIllustration, Illustration } from './EmptyStateIllustration';
export { StateSwitch } from './StateSwitch';
export { LoadingState } from './LoadingState';
export { ErrorState } from './ErrorState';

/* ── HOCs (in shell, but they lazy-load the heavy modal/drawer chunks) ─── */
export { SelectWithQuickCreate } from './SelectWithQuickCreate';
export { ListWithEmptyState } from './ListWithEmptyState';
export type { ListWithEmptyStateProps } from './ListWithEmptyState';
export { SubformWithEmptyState } from './SubformWithEmptyState';
export { RelatedDataPanel } from './RelatedDataPanel';

/* ── Telemetry hook ──────────────────────────────────────────────────── */
export { useEmptyStateTelemetry } from './useEmptyStateTelemetry';
export type { EmptyStateTelemetryApi } from './useEmptyStateTelemetry';

/* ── Motion tokens ───────────────────────────────────────────────────── */
export {
  SPRING_GENTLE,
  SPRING_TACTILE,
  DURATION_FAST,
  DURATION_NORMAL,
  DURATION_SLOW,
  STAGGER_DELAY,
  STAGGER_MAX_INDEX,
  emptyStateEnter,
  emptyStateEnterReduced,
  modalEnter,
  drawerEnter,
  highlightPulse,
  rowStaggerVariants,
  entranceVariants,
  CTA_HOVER_SCALE,
  CTA_PRESS_SCALE,
  CTA_HOVER_DURATION,
} from './motion';

/* ── Types ───────────────────────────────────────────────────────────── */
export type {
  EntitySlug,
  EntityClass,
  IllustrationKey,
  EmptyStateVariant,
  EmptyStateProps,
  EmptyStateAction,
  EmptyStateContext,
  PermissionGate,
  StateSwitchProps,
  LoadingStateProps,
  ErrorStateProps,
  FieldDef,
  FieldOption,
  FieldType,
  QuickCreateConfig,
  QuickCreateValues,
  QuickCreateResult,
  QuickCreatePrefill,
  QuickCreateUIProps,
  ApiCreateContext,
  LoadOptionsResult,
  QueryInheritance,
  SelectWithQuickCreateProps,
  SubformWithEmptyStateProps,
  RelatedDataPanelProps,
  ReturnContextPayload,
} from './types';
