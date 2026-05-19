/**
 * `ResponsiveForm` — single-column-on-mobile pattern (system-wide-ux-overhaul,
 * task 4.3).
 *
 * A thin, structural wrapper that enforces the umbrella spec's responsive
 * contract for every Form in the product without forcing call sites to
 * re-implement viewport branching:
 *
 *   1. Layout (R4.5) — grid container whose column count is derived from
 *      `useViewport()`. Mobile_Viewport (`width <= 640 px`) is ALWAYS a
 *      single column regardless of the declared `layout` prop. Above 640 px
 *      the consumer's choice (`'single'` | `'two-column'`) is honoured.
 *
 *   2. Touch targets (R4.4, R5.1) — descendant rules in
 *      `responsiveForm.css` set `min-block-size: 44px` on every nested
 *      input, select, textarea, button, AntD form control, switch,
 *      checkbox, radio, and date-picker trigger when the viewport is
 *      `≤ 1024 px` (Mobile_Viewport + Tablet_Viewport per R5.1).
 *
 *   3. Spacing (R5.2) — adjacent Touch_Targets stay ≥ 8 px apart via the
 *      grid `row-gap` and `column-gap` declared inline below. The numeric
 *      values come from `theme/tokens.ts` via `formSpacing` in the
 *      sibling `responsiveFormSpacing.ts` module.
 *
 *   4. Line-item subforms (R4.8) — the {@link ResponsiveForm.LineItem}
 *      sub-component renders as an expandable `<details>` card on
 *      Mobile_Viewport, with the most-important field(s) visible in the
 *      `<summary>` and the rest of the form behind a tappable "Edit
 *      details" affordance. Above Mobile_Viewport the line-item renders
 *      inline so multi-column line-item editors keep working unchanged.
 *
 * Lint contract
 * -------------
 * This file lives under `frontend/src/components/responsive/**` which is
 * scoped to the `zoho-i18n/no-hardcoded-literal` rule at error severity
 * (see `eslint.config.js`). The wrapper is purely structural — it has
 * NO user-facing copy of its own. The only string surfaced to the user
 * is the line-item "Edit details" toggle label, which is resolved
 * through `t()` against the i18n_Registry (R11.4, R13.4, R13.5).
 *
 * Logical-CSS only — no `left`/`right`/`margin-left`/`padding-right`
 * (R3.8, R14.7).
 *
 * _Validates: Requirements 4.4, 4.5, 4.8, 5.1, 5.2_
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { useViewport } from '../../hooks/useViewport';
import {
  asTranslationKey,
  type TranslationKey,
} from '../../i18n/types';

import {
  formSpacing,
  resolveGridTemplate,
  type ResponsiveFormLayout,
} from './responsiveFormSpacing';

import './responsiveForm.css';

// ---------------------------------------------------------------------------
// ResponsiveForm
// ---------------------------------------------------------------------------

/**
 * Props for {@link ResponsiveForm}. Shape pinned by
 * `system-wide-ux-overhaul/design.md` → "Responsive Patterns Catalog" →
 * "ResponsiveForm".
 */
export interface ResponsiveFormProps {
  /**
   * Layout for viewports `> 640 px`. On Mobile_Viewport this prop is
   * intentionally ignored — the layout is always a single column (R4.5).
   *
   * Defaults to `'single'` so consumers that simply wrap their existing
   * vertical form get a sensible default.
   */
  layout?: ResponsiveFormLayout;

  /**
   * Form content. Typically a sequence of `<Form.Item>` (AntD) or other
   * field components — `ResponsiveForm` does not impose a particular
   * field library; the descendant CSS rules in `responsiveForm.css`
   * cover both native HTML controls and AntD form controls.
   */
  children: React.ReactNode;

  /**
   * Optional className composed onto the wrapper. The internal
   * `responsive-form` class is always applied; consumers MUST NOT
   * override the grid columns or row-gap from outside (those are
   * derived from `useViewport()` and the `layout` prop).
   */
  className?: string;

  /** Optional inline style merged with the computed grid styles. */
  style?: React.CSSProperties;
}

/**
 * Single-column-on-mobile form wrapper. See module-level JSDoc for the
 * full contract.
 *
 * @example
 *   <ResponsiveForm layout="two-column">
 *     <Form.Item label={t('user.name')} name="name">
 *       <Input />
 *     </Form.Item>
 *     <Form.Item label={t('user.email')} name="email">
 *       <Input />
 *     </Form.Item>
 *   </ResponsiveForm>
 */
const ResponsiveFormBase: React.FC<ResponsiveFormProps> = ({
  layout = 'single',
  children,
  className,
  style,
}) => {
  const { isMobile } = useViewport();

  const gridTemplate = resolveGridTemplate(isMobile, layout);

  const composedClassName = className
    ? `responsive-form ${className}`
    : 'responsive-form';

  // Styles intentionally come AFTER the spread of `style` so consumer
  // overrides cannot break the grid contract.
  const composedStyle: React.CSSProperties = {
    ...style,
    display: 'grid',
    gridTemplateColumns: gridTemplate,
    rowGap: formSpacing.rowGap,
    columnGap: formSpacing.columnGap,
  };

  return (
    <div className={composedClassName} style={composedStyle}>
      {children}
    </div>
  );
};

// ---------------------------------------------------------------------------
// ResponsiveForm.LineItem
// ---------------------------------------------------------------------------

/**
 * Props for {@link LineItem}. Implements the line-item-as-expandable-card
 * contract from R4.8.
 */
export interface ResponsiveFormLineItemProps {
  /**
   * The most-important fields of the line item, rendered inline in the
   * `<summary>` of the disclosure on Mobile_Viewport (R4.8). On larger
   * viewports the summary content is rendered alongside the body in a
   * single inline block so two-column line-item editors continue to
   * work unchanged.
   *
   * Typical content: the line item's name / SKU and total — i.e., the
   * fields a user can recognise at a glance without expanding the row.
   */
  summary: React.ReactNode;

  /**
   * The remaining fields of the line item — quantity, unit price,
   * discount, tax, etc. — that sit behind the "Edit details" affordance
   * on Mobile_Viewport.
   */
  children: React.ReactNode;

  /**
   * Optional translation key for the disclosure toggle label. Defaults
   * to `'responsiveForm.lineItem.editDetails'`. Resolved through `t()`
   * so RTL / Kurdish renders correctly (R11.6, R12.1).
   */
  toggleLabelKey?: TranslationKey;

  /** Whether the line item starts expanded. Defaults to `false`. */
  defaultOpen?: boolean;

  /** Optional className composed onto the wrapper. */
  className?: string;
}

/**
 * Default i18n key for the line-item disclosure toggle. Owned by the
 * i18n_Registry; the value ("Edit details" / equivalent in Kurdish) is
 * backfilled by task 6.4 of the umbrella plan.
 */
const DEFAULT_TOGGLE_LABEL_KEY: TranslationKey = asTranslationKey(
  'responsiveForm.lineItem.editDetails',
);

/**
 * Expandable-card line-item subform (R4.8). Uses the native
 * `<details>` / `<summary>` element so:
 *
 *   - keyboard activation (Enter, Space) works out of the box,
 *   - the disclosure state is preserved across re-renders,
 *   - assistive technology already understands the role,
 *   - no JavaScript is required to toggle the body.
 *
 * On Mobile_Viewport the wrapper carries the `responsive-form__line-item--card`
 * class which adds card chrome + an inline-end-anchored "Edit details"
 * label. Above Mobile_Viewport the wrapper switches to
 * `responsive-form__line-item--inline` and the body renders inline.
 */
const LineItem: React.FC<ResponsiveFormLineItemProps> = ({
  summary,
  children,
  toggleLabelKey = DEFAULT_TOGGLE_LABEL_KEY,
  defaultOpen = false,
  className,
}) => {
  const { t } = useTranslation();
  const { isMobile } = useViewport();

  // Resolved through t() — never a raw user-facing literal here.
  const toggleLabel = t(toggleLabelKey);

  // Above Mobile_Viewport, render the line-item flat (summary then body)
  // so multi-column line-item editors continue to work as before.
  if (!isMobile) {
    const composed = className
      ? `responsive-form__line-item responsive-form__line-item--inline ${className}`
      : 'responsive-form__line-item responsive-form__line-item--inline';
    return (
      <div className={composed}>
        <div>{summary}</div>
        <div>{children}</div>
      </div>
    );
  }

  // Mobile_Viewport: native disclosure with card chrome.
  const composed = className
    ? `responsive-form__line-item responsive-form__line-item--card ${className}`
    : 'responsive-form__line-item responsive-form__line-item--card';

  return (
    <details className={composed} open={defaultOpen}>
      <summary>
        <span style={{ flex: 1, minInlineSize: 0 }}>{summary}</span>
        <span
          className="responsive-form__line-item-toggle"
          aria-hidden="true"
        >
          {toggleLabel}
        </span>
      </summary>
      <div className="responsive-form__line-item-body">{children}</div>
    </details>
  );
};

// ---------------------------------------------------------------------------
// Public surface — `ResponsiveForm` with attached `LineItem` sub-component.
// ---------------------------------------------------------------------------

interface ResponsiveFormCompound extends React.FC<ResponsiveFormProps> {
  /** Line-item subform — expandable card on Mobile_Viewport (R4.8). */
  LineItem: React.FC<ResponsiveFormLineItemProps>;
}

/**
 * Single-column-on-mobile form wrapper.
 *
 * @see ResponsiveFormProps
 * @see ResponsiveForm.LineItem
 */
export const ResponsiveForm: ResponsiveFormCompound =
  ResponsiveFormBase as ResponsiveFormCompound;
ResponsiveForm.LineItem = LineItem;

export default ResponsiveForm;
