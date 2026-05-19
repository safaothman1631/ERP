/**
 * ARIA Contracts — Accessibility utilities for interactive elements.
 *
 * Validates: Requirements 14.3, 14.5, 14.6
 *
 * This module provides constants, types, and utilities to enforce ARIA
 * contracts across the application:
 *
 * 1. Every interactive element lacking visible text MUST have `aria-label`
 *    or `aria-labelledby` sourced from the i18n registry (R14.5).
 * 2. Dynamic content changes (toasts, validation summaries, lockout
 *    countdowns) MUST use `aria-live` regions (R14.6).
 * 3. Visible focus rings MUST be sourced from `theme/tokens.ts`; no
 *    `outline: none` without a replacement focus indicator (R14.3).
 *
 * @see `frontend/src/theme/tokens.ts` — `a11y` token group.
 * @see `frontend/src/i18n/types.ts` — ARIA contract documentation.
 * @see `frontend/src/design-system/Toast.tsx` — aria-live toast announcer.
 */

import { a11y } from '../theme/tokens';

// ─────────────────────────────────────────────────────────────────────────────
// Focus Ring Tokens (R14.3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CSS custom property values for the visible focus ring, sourced from
 * `theme/tokens.ts`. Use these when building custom focus indicators.
 *
 * The focus ring MUST meet WCAG AA non-text contrast (≥ 3:1).
 */
export const focusRing = {
  width: `${a11y.focusRingWidth}px`,
  offset: `${a11y.focusRingOffset}px`,
  color: a11y.focusRingColor,
  colorDark: a11y.focusRingColorDark,
  /** Complete outline shorthand for use in inline styles. */
  outline: `${a11y.focusRingWidth}px solid ${a11y.focusRingColor}`,
  outlineDark: `${a11y.focusRingWidth}px solid ${a11y.focusRingColorDark}`,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// aria-live Politeness Levels (R14.6)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Politeness levels for `aria-live` regions.
 *
 * - `polite`: Non-urgent updates — toasts, status changes, search result
 *   counts. Screen readers announce at the next graceful opportunity.
 * - `assertive`: Urgent updates — error alerts, lockout countdowns,
 *   validation failures. Screen readers interrupt current speech.
 *
 * @example
 * ```tsx
 * <div aria-live={ARIA_LIVE.POLITE} aria-atomic="true">
 *   {t('toast.saved')}
 * </div>
 * ```
 */
export const ARIA_LIVE = {
  /** Non-urgent: toasts, status changes, counters. */
  POLITE: 'polite',
  /** Urgent: errors, lockout warnings, validation failures. */
  ASSERTIVE: 'assertive',
  /** Turned off — region will not announce changes. */
  OFF: 'off',
} as const;

export type AriaLivePoliteness = typeof ARIA_LIVE[keyof typeof ARIA_LIVE];

// ─────────────────────────────────────────────────────────────────────────────
// ARIA Label Helpers (R14.5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props to spread on an interactive element that lacks visible text.
 * Every icon-only button, toggle, or control MUST use one of these patterns.
 *
 * @example
 * ```tsx
 * // Pattern 1: aria-label from i18n
 * <Button icon={<DeleteOutlined />} {...ariaLabel(t('common.delete'))} />
 *
 * // Pattern 2: aria-labelledby pointing to a visible label
 * <span id="section-title">{t('sales.invoices.title')}</span>
 * <Button icon={<PlusOutlined />} {...ariaLabelledBy('section-title')} />
 * ```
 */
export function ariaLabel(label: string): { 'aria-label': string } {
  return { 'aria-label': label };
}

export function ariaLabelledBy(id: string): { 'aria-labelledby': string } {
  return { 'aria-labelledby': id };
}

// ─────────────────────────────────────────────────────────────────────────────
// Common ARIA Labels for Icon-Only Buttons (R14.5)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Translation key constants for common icon-only button actions.
 * Use with `t()` to resolve the localized aria-label.
 *
 * These keys correspond to existing entries in `en.json` and `ku.json`.
 *
 * @example
 * ```tsx
 * <Button
 *   icon={<DeleteOutlined />}
 *   danger
 *   aria-label={t(ICON_BUTTON_LABELS.delete)}
 * />
 * ```
 */
export const ICON_BUTTON_LABELS = {
  delete: 'delete',
  edit: 'edit',
  view: 'view',
  close: 'close',
  add: 'add',
  search: 'search',
  filter: 'filter',
  refresh: 'refresh',
  download: 'download',
  upload: 'upload',
  more: 'more',
  expand: 'expand_all',
  collapse: 'collapse_all',
  moveUp: 'move_up',
  moveDown: 'move_down',
} as const;
