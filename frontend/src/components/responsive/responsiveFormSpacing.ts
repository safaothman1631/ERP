/**
 * `formSpacing` token group + `resolveGridTemplate` helper for
 * `ResponsiveForm` (system-wide-ux-overhaul, task 4.3).
 *
 * Extracted from `ResponsiveForm.tsx` so the component file only exports
 * components — required by `react-refresh/only-export-components`. This
 * file is intentionally pure data and a single pure helper, with no React
 * imports, so it can be consumed by tests, CI scripts, and the line-item
 * subform without dragging the renderer into every consumer.
 *
 * Cross-spec boundary
 * -------------------
 * The umbrella design.md notes that adjacent-target spacing should come
 * from a `formSpacing` token group. That group is owned by
 * `ui-redesign-modern` (per R17.3 — `theme/tokens.ts` is consumed
 * read-only here). At the time this module is written `formSpacing` does
 * NOT yet exist in `tokens.ts`. We therefore consume the existing `space`
 * group as the canonical fallback (`space.sm = 8 px`, `space.lg = 16 px`)
 * so the spacing contract is already met today; once `ui-redesign-modern`
 * adds a dedicated `formSpacing` group, this file is the single touchpoint
 * that needs updating.
 *
 * _Validates: Requirements 4.5, 5.2_
 */

import { space } from '../../theme/tokens';

/**
 * Numeric spacing values consumed by `ResponsiveForm` and its line-item
 * subforms. Sourced from `theme/tokens.ts` (R17.3 — read-only consumption
 * of `ui-redesign-modern`'s tokens).
 */
export const formSpacing = {
  /** Adjacent-touch-target gap on Mobile_Viewport (R5.2) — 8 px. */
  adjacentTargetGap: space.sm,
  /** Row gap between fields in the grid container — 16 px. */
  rowGap: space.lg,
  /** Column gap between fields on multi-column layouts — 16 px. */
  columnGap: space.lg,
} as const;

/**
 * Layout choice for viewports above the Mobile_Viewport breakpoint.
 *
 * On Mobile_Viewport (`width <= 640 px`) the layout is forced to a single
 * column regardless of this value (R4.5).
 */
export type ResponsiveFormLayout = 'single' | 'two-column';

/**
 * Resolve the grid-template-columns string for the current viewport and
 * declared layout. Pure helper — extracted for unit testing.
 *
 * @param isMobile - Whether the active viewport is Mobile_Viewport
 *                   (`useViewport().isMobile`).
 * @param layout   - The consumer-declared layout for viewports above
 *                   Mobile_Viewport.
 *
 * Mobile_Viewport ALWAYS resolves to a single column regardless of
 * `layout` (R4.5).
 */
export function resolveGridTemplate(
  isMobile: boolean,
  layout: ResponsiveFormLayout,
): string {
  // Mobile_Viewport always renders a single column (R4.5).
  if (isMobile) return 'minmax(0, 1fr)';
  if (layout === 'two-column') return 'minmax(0, 1fr) minmax(0, 1fr)';
  return 'minmax(0, 1fr)';
}
