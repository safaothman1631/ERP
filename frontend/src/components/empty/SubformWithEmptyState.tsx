/**
 * @file SubformWithEmptyState.tsx
 * @deprecated EP-FINAL: this file is now a back-compat re-export.
 * The canonical implementation lives at
 * `frontend/src/design-system/empty/SubformWithEmptyState.tsx` and accepts
 * BOTH the EP-0 (`empty`/`children`/`onAdd`) and the legacy EP-5
 * (`items`/`render`/`onAddFirst`/`emptyTitleKey`/...) prop signatures.
 *
 * New code SHOULD import directly from `design-system/empty/SubformWithEmptyState`.
 * Remove this shim once the audit reports zero importers under
 * `components/empty/`.
 */

export { SubformWithEmptyState } from '../../design-system/empty/SubformWithEmptyState';
export type { SubformWithEmptyStateProps } from '../../design-system/empty/types';
export { SubformWithEmptyState as default } from '../../design-system/empty/SubformWithEmptyState';
