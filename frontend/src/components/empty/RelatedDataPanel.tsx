/**
 * @file RelatedDataPanel.tsx
 * @deprecated EP-FINAL: this file is now a back-compat re-export.
 * The canonical implementation lives at
 * `frontend/src/design-system/empty/RelatedDataPanel.tsx` and accepts BOTH
 * the EP-0 (`empty`/`children`) and the legacy EP-5 (`data`/`loading`/
 * `emptyTitleKey`/`emptyTitleFallback`/...) prop signatures.
 *
 * New code SHOULD import directly from `design-system/empty/RelatedDataPanel`.
 * This shim exists so any stragglers compiled against the old path keep
 * working through one merge cycle. Remove this file once the audit reports
 * zero importers under `components/empty/`.
 */

export { RelatedDataPanel } from '../../design-system/empty/RelatedDataPanel';
export type { RelatedDataPanelProps } from '../../design-system/empty/types';
export { RelatedDataPanel as default } from '../../design-system/empty/RelatedDataPanel';
