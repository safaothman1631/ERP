/**
 * `EmptyState` — shared Empty_State component for the Selective_Add system
 * (system-wide-ux-overhaul, R1.4, R9.8, R17.2).
 *
 * Rendered by every Section that supports adding records when the Section
 * has zero records, and by the `nav-settings-cleanup` Empty-Select Add
 * escape-hatch (R17.2 — no duplicate component product-wide). Always shows
 *
 *   1. an illustration / icon (defaults to AntD's `Empty.PRESENTED_IMAGE_SIMPLE`),
 *   2. a one-sentence description in the Active_Language,
 *   3. a primary call-to-action button in the Active_Language.
 *
 * All user-facing copy is resolved through `t()` against
 * `frontend/src/locales/{en,ku}.json` — no raw literals appear here, in
 * compliance with the `no-hardcoded-literal` ESLint rule scoped to
 * `frontend/src/components/AddGate/**` (R11.4, R13.4, R13.5).
 *
 * Mandatory-mode override (R9.8)
 * ------------------------------
 * When the consumer passes `mandatory={true}` (typically derived from
 * `useAddGate(sectionId).mode === 'mandatory'`), the description copy is
 * replaced with the canonical mandatory CTA key
 * {@link MANDATORY_DESCRIPTION_KEY} = `'addGate.atLeastOneRequired'`. The
 * value of that key is owned by the i18n_Registry and backfilled in task
 * 6.4 of the umbrella plan.
 *
 * Visual treatment
 * ----------------
 * Reuses the design tokens (`palette`, `space`) and the `MotionButton`
 * primitive owned by `ui-redesign-modern` so that this Empty_State is
 * visually identical to the existing `design-system/EmptyState` and to
 * any other Empty_State in the product. This component is **not** a
 * stylistic fork — it is the AddGate-aware wrapper around the same
 * primitives, with `TranslationKey` props enforcing i18n at the type
 * boundary.
 *
 * Reuse contract
 * --------------
 * The same component is consumed by:
 *
 *   - every Section migrated in tasks 10.6 and 10.8;
 *   - the Empty-Select Add escape-hatch in `nav-settings-cleanup`
 *     (R17.2 — no duplicate component);
 *   - onboarding / multi-step flow steps that bind to a `sectionId`
 *     (task 10.7).
 *
 * _Validates: Requirements 1.4, 9.8, 17.2_
 */

import React from 'react';
import { Empty } from 'antd';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { palette, space } from '../../theme/tokens';
import { asTranslationKey, type TranslationKey } from '../../i18n/types';
import { MotionButton } from '../MotionButton';

/**
 * Translation key used in place of {@link EmptyStateProps.descriptionKey}
 * when `mandatory` is `true` (R9.8).
 *
 * The literal string is the i18n key only — its locale value
 * ("Add at least one to continue" in English, equivalent in Kurdish) is
 * owned by the i18n_Registry and backfilled in task 6.4. Marked as a
 * {@link TranslationKey} via {@link asTranslationKey} so the type system
 * treats it as a vetted key, not a Hardcoded_Literal.
 *
 * Kept in sync with `EMPTY_STATE_CTA_KEY` in
 * `frontend/src/components/AddGate/useAddGate.ts`. The two constants live
 * in different modules because the hook returns the key while the
 * component performs the override; the canonical source-of-truth is the
 * locale file.
 */
const MANDATORY_DESCRIPTION_KEY: TranslationKey = asTranslationKey(
  'addGate.atLeastOneRequired',
);

/**
 * Props for {@link EmptyState}. Shape pinned by `system-wide-ux-overhaul/
 * design.md` → "Selective Add System" → "Empty_State Component".
 */
export interface EmptyStateProps {
  /**
   * Optional illustration or icon node. When omitted, AntD's neutral
   * `Empty.PRESENTED_IMAGE_SIMPLE` placeholder is rendered so that every
   * Section honours R1.4 ("an illustration or icon") even before bespoke
   * artwork is authored.
   */
  illustration?: React.ReactNode;

  /** {@link TranslationKey} for the Empty_State title. */
  titleKey: TranslationKey;

  /**
   * {@link TranslationKey} for the Empty_State description.
   *
   * When {@link EmptyStateProps.mandatory} is `true`, this prop is
   * **ignored** and {@link MANDATORY_DESCRIPTION_KEY} is rendered instead
   * (R9.8). The mandatory override is intentional: the caller should not
   * have to provide a mandatory-aware description per Section — a single
   * canonical phrasing is used product-wide.
   */
  descriptionKey: TranslationKey;

  /** {@link TranslationKey} for the primary CTA button label. */
  ctaKey: TranslationKey;

  /** Click handler for the primary CTA. */
  onCta: () => void;

  /**
   * Mandatory-mode flag. Typically sourced from
   * `useAddGate(sectionId).mode === 'mandatory'`. When `true`, the
   * description copy is overridden with the canonical
   * "Add at least one to continue" key (R9.8).
   *
   * Defaults to `false` for safety — Sections that have not yet been
   * migrated to `useAddGate` render the description their caller passed.
   */
  mandatory?: boolean;
}

/**
 * Internal component implementation. Wrapped by `React.memo` below to
 * keep the public export consistent with `design-system/EmptyState`.
 */
const EmptyStateInner: React.FC<EmptyStateProps> = ({
  illustration,
  titleKey,
  descriptionKey,
  ctaKey,
  onCta,
  mandatory = false,
}) => {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  // Mandatory-mode override (R9.8). The value passed in `descriptionKey`
  // is intentionally ignored when `mandatory` is `true` so the
  // product-wide phrasing surface stays consistent.
  const resolvedDescriptionKey: TranslationKey = mandatory
    ? MANDATORY_DESCRIPTION_KEY
    : descriptionKey;

  const title = t(titleKey);
  const description = t(resolvedDescriptionKey);
  const cta = t(ctaKey);

  return (
    <motion.div
      role="region"
      aria-label={title}
      initial={reduce ? false : { opacity: 0, scale: 0.97 }}
      animate={reduce ? undefined : { opacity: 1, scale: 1 }}
      transition={{ duration: reduce ? 0 : 0.22 }}
      style={{
        padding: `${space.xxxl}px ${space.xl}px`,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: space.md,
      }}
    >
      {illustration ? (
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 18,
            background: palette.primary50,
            color: palette.primary500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
          }}
        >
          {illustration}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={null} />
      )}
      <div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: palette.ink900,
            marginBottom: 4,
          }}
        >
          {title}
        </div>
        <div
          style={{
            color: palette.ink500,
            fontSize: 14,
            maxWidth: 420,
          }}
        >
          {description}
        </div>
      </div>
      <MotionButton type="primary" size="large" onClick={onCta}>
        {cta}
      </MotionButton>
    </motion.div>
  );
};

/**
 * Shared Empty_State component (R1.4, R9.8, R17.2). Memoized to avoid
 * unnecessary re-renders when the parent Section's record count
 * fluctuates around `0` and other Provider state changes.
 */
export const EmptyState = React.memo(EmptyStateInner);

export default EmptyState;
