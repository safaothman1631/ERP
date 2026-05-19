/**
 * Accessibility (WCAG AA) utilities — system-wide-ux-overhaul.
 *
 * Validates: Requirements 14.3, 14.5, 14.6
 *
 * Re-exports ARIA contract helpers, focus ring tokens, and aria-live
 * constants for use across the application.
 */
export {
  focusRing,
  ARIA_LIVE,
  ariaLabel,
  ariaLabelledBy,
  ICON_BUTTON_LABELS,
  type AriaLivePoliteness,
} from './aria-contracts';
